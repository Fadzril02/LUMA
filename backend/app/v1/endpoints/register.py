from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
import re
from datetime import datetime, timezone
try:
    from app.core.auth import verify_advisor_jwt
    from app.core.supabase_client import SupabaseService
except ImportError:
    from backend.app.core.auth import verify_advisor_jwt
    from backend.app.core.supabase_client import SupabaseService

router = APIRouter(prefix="/register", tags=["Registration"])

class StudentRegisterRequest(BaseModel):
    cohort_code: str
    matric_no: str
    full_name: str

class AdvisorRegisterRequest(BaseModel):
    invite_code: str
    full_name: str
    staff_id: str
    department: str

@router.post("/student")
async def register_student(req: StudentRegisterRequest, jwt_payload: dict = Depends(verify_advisor_jwt)):
    jwt_sub = jwt_payload.get("sub")
    jwt_email = jwt_payload.get("email", "").lower()
    if not jwt_sub:
        raise HTTPException(status_code=401, detail="Invalid JWT: missing sub")

    svc = SupabaseService()
    
    # 1. Look up cohort
    cohort_res = svc.client.table("cohorts").select("id, advisor_staff_id, template_id, tenant_id, is_locked").eq("cohort_code", req.cohort_code).limit(1).execute()
    if not cohort_res.data:
        raise HTTPException(status_code=400, detail="Invalid cohort code")
    cohort = cohort_res.data[0]
    
    if cohort.get("is_locked"):
        raise HTTPException(status_code=400, detail="Cohort is locked")
        
    tenant_id = cohort.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=500, detail="Cohort has no tenant_id")
        
    # 2. Get program and syllabus from degree_templates
    template_res = svc.client.table("degree_templates").select("program_code, syllabus_year").eq("id", cohort["template_id"]).limit(1).execute()
    if not template_res.data:
        raise HTTPException(status_code=500, detail="Degree template not found")
    program = template_res.data[0]["program_code"]
    syllabus_type = template_res.data[0]["syllabus_year"]
    
    # 3. Get tenant config
    tenant_res = svc.client.table("tenants").select("matric_regex, student_email_domains").eq("id", tenant_id).limit(1).execute()
    if not tenant_res.data:
        raise HTTPException(status_code=500, detail="Tenant config not found")
    tenant = tenant_res.data[0]
    
    # 4. Validate domain
    domain = jwt_email.split("@")[-1] if "@" in jwt_email else ""
    if domain not in tenant["student_email_domains"]:
        raise HTTPException(status_code=400, detail="Email domain not allowed for this tenant")
        
    # 5. Validate matric
    normalized_matric = req.matric_no.strip().upper()
    if not re.fullmatch(tenant["matric_regex"], normalized_matric):
        raise HTTPException(status_code=400, detail="Invalid matric number format")
        
    # 6. Check duplicates matric_no explicitly
    dup_res = svc.client.table("students").select("matric_no").eq("tenant_id", tenant_id).eq("matric_no", normalized_matric).execute()
    if dup_res.data:
        raise HTTPException(status_code=409, detail="Matric number already registered")
        
    # 7. Check duplicates user_id
    user_res = svc.client.table("students").select("user_id").eq("user_id", jwt_sub).limit(1).execute()
    if user_res.data:
        raise HTTPException(status_code=409, detail="User already registered as student")
        
    # 8. Insert student
    try:
        svc.client.table("students").insert({
            "matric_no": normalized_matric,
            "user_id": jwt_sub,
            "name": req.full_name,
            "institutional_email": jwt_email,
            "advisor_staff_id": cohort["advisor_staff_id"],
            "program": program,
            "syllabus_type": syllabus_type,
            "cohort_id": cohort["id"],
            "tenant_id": tenant_id
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Matric number already registered")
        raise
    
    # 9. Set app_metadata
    try:
        svc.client.auth.admin.update_user_by_id(jwt_sub, {"app_metadata": {"role": "student", "tenant_id": tenant_id}})
    except Exception as e:
        # Rollback insert
        svc.client.table("students").delete().eq("tenant_id", tenant_id).eq("user_id", jwt_sub).eq("matric_no", normalized_matric).execute()
        raise HTTPException(status_code=500, detail="Registration incomplete: role assignment failed")
        
    return {"status": "success"}

@router.post("/advisor")
async def register_advisor(req: AdvisorRegisterRequest, jwt_payload: dict = Depends(verify_advisor_jwt)):
    jwt_sub = jwt_payload.get("sub")
    jwt_email = jwt_payload.get("email", "").lower()
    if not jwt_sub:
        raise HTTPException(status_code=401, detail="Invalid JWT: missing sub")

    svc = SupabaseService()
    
    # 1. staff_id duplicate check
    dup_res = svc.client.table("advisors").select("staff_id").eq("staff_id", req.staff_id).limit(1).execute()
    if dup_res.data:
        raise HTTPException(status_code=409, detail="Staff ID already registered")
        
    # 2. Claim invite atomically
    now_iso = datetime.now(timezone.utc).isoformat()
    update_res = svc.client.table("advisor_invites").update({
        "used_by": jwt_sub,
        "used_at": now_iso
    }).eq("code", req.invite_code).is_("used_by", "null").gt("expires_at", now_iso).execute()
    
    if not update_res.data:
        raise HTTPException(status_code=400, detail="Invalid, expired, or already used invite code")
        
    tenant_id = update_res.data[0]["tenant_id"]
        
    # 3. Insert advisor
    try:
        svc.client.table("advisors").insert({
            "staff_id": req.staff_id,
            "user_id": jwt_sub,
            "name": req.full_name,
            "institutional_email": jwt_email,
            "department": req.department,
            "tenant_id": tenant_id
        }).execute()
    except Exception as e:
        # Release invite
        svc.client.table("advisor_invites").update({
            "used_by": None,
            "used_at": None
        }).eq("code", req.invite_code).eq("used_by", jwt_sub).execute()
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Staff ID already registered")
        raise
    
    # 4. Set app_metadata
    try:
        svc.client.auth.admin.update_user_by_id(jwt_sub, {"app_metadata": {"role": "advisor", "tenant_id": tenant_id}})
    except Exception as e:
        # Rollback advisor and release invite
        svc.client.table("advisors").delete().eq("user_id", jwt_sub).eq("staff_id", req.staff_id).execute()
        svc.client.table("advisor_invites").update({
            "used_by": None,
            "used_at": None
        }).eq("code", req.invite_code).eq("used_by", jwt_sub).execute()
        raise HTTPException(status_code=500, detail="Registration incomplete: role assignment failed")
        
    return {"status": "success"}

@router.get("/validate-cohort/{code}")
async def validate_cohort(code: str):
    svc = SupabaseService()
    res = svc.client.table("cohorts").select("id, is_locked").eq("cohort_code", code).limit(1).execute()
    if not res.data:
        return {"valid": False}
    return {"valid": not res.data[0].get("is_locked")}
