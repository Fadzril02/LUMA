from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import pdfplumber
import google.generativeai as genai
import json
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not all([API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("CRITICAL ERROR: Missing API Keys in .env file!")

app = FastAPI(title="SE Smart AA System Backend")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

class ExtractRequest(BaseModel):
    file_path: str

SYSTEM_PROMPT = """
You are a highly precise data extraction AI for a university academic advising system.
Your only job is to read the raw text of an examination slip and extract the student's grades.
You must strictly ignore all other text, warnings, or footers.

Pay special attention to grades like 'HL' (Hadir Lulus) and ensure they are captured exactly as written.

You MUST return ONLY a valid JSON object matching this exact structure:
{
  "academic_session": "e.g., 2024/2025",
  "semester": 1,
  "courses": [
    {
      "course_code": "e.g., SCSE1013",
      "grade": "e.g., A, B+, HL",
      "credit_hour": 3,
      "status": "e.g., Pass"
    }
  ]
}
"""

def extract_transcript_data(pdf_path: str):
    raw_text = ""
    is_fraudulent = False
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            metadata = pdf.metadata
            if metadata:
                creator = metadata.get('Creator', '').lower()
                producer = metadata.get('Producer', '').lower()
                
                # Demo list: Includes word/google to trigger your fake test file
                suspicious_software = ['adobe illustrator', 'photoshop', 'canva', 'ilovepdf', 'microsoft', 'word', 'google']
                
                if any(suspect in creator for suspect in suspicious_software) or \
                   any(suspect in producer for suspect in suspicious_software):
                    print(f"⚠️ FRAUD DETECTED: PDF created by {creator} / {producer}")
                    is_fraudulent = True

            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    raw_text += text + "\n"
    except Exception as e:
        raise ValueError(f"Failed to read PDF: {str(e)}")

    if not raw_text.strip():
        raise ValueError("PDF is empty or unreadable.")

    try:
        response = model.generate_content(
            SYSTEM_PROMPT + "\n\n--- RAW TEXT ---\n" + raw_text,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0, 
                response_mime_type="application/json", 
            ),
        )
        
        result_json = json.loads(response.text)
        result_json['fraud_flag'] = is_fraudulent 
        return result_json
        
    except Exception as e:
        raise ValueError(f"AI Extraction failed: {str(e)}")

@app.post("/api/extract")
async def extract_pdf(request: ExtractRequest):
    temp_file_path = f"temp_{os.path.basename(request.file_path)}"
    
    try:
        print(f"📥 Downloading {request.file_path} from Supabase...")
        res = supabase.storage.from_("academic-slips").download(request.file_path)
        
        with open(temp_file_path, "wb") as f:
            f.write(res)
            
        print("🧠 Running AI Extraction...")
        extracted_json = extract_transcript_data(temp_file_path)
        return {"success": True, "data": extracted_json}
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.get("/")
def read_root():
    return {"status": "Backend Engine is Online"}