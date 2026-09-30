import axios from 'axios';
import { toast } from 'sonner';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // 75 s — covers Render free-tier cold start (up to 60 s) plus actual request time
  timeout: 75000,
});

// Surface a clear message when the backend is cold-starting or unreachable
apiClient.interceptors.response.use(
  (response) => {
    const timer = (response?.config as any)?._slowServerTimer;
    if (timer) clearTimeout(timer);
    toast.dismiss('server-waking');
    return response;
  },
  (error) => {
    const timer = (error?.config as any)?._slowServerTimer;
    if (timer) clearTimeout(timer);
    toast.dismiss('server-waking');

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.message =
        'The server took too long to respond. It may be starting up — please wait 30 seconds and try again.';
    } else if (!error.response) {
      error.message =
        'Cannot reach the backend server. Check your network or try again shortly.';
    }
    return Promise.reject(error);
  }
);

// Automatically attach Supabase JWT token to outgoing API requests.
// FIX #4: Use refreshSession() when the cached token is expired or near expiry
// to prevent the "upload fails until relogin" symptom caused by stale access tokens.
apiClient.interceptors.request.use(async (config) => {
  const timer = setTimeout(() => {
    toast("Server is starting, please wait… this can take up to a minute.", {
      id: "server-waking",
    });
  }, 5000);
  (config as any)._slowServerTimer = timer;

  let { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // Check if the access token is expired or within 60 seconds of expiry
    const expiresAt = session.expires_at ?? 0; // Unix timestamp (seconds)
    const nowSec = Math.floor(Date.now() / 1000);
    const isExpiredOrNearExpiry = expiresAt - nowSec < 60;

    if (isExpiredOrNearExpiry) {
      // Force a token refresh so we always send a valid JWT
      const refreshResult = await supabase.auth.refreshSession();
      if (refreshResult.data?.session) {
        session = refreshResult.data.session;
      }
    }
  }

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  const timer = (error?.config as any)?._slowServerTimer;
  if (timer) clearTimeout(timer);
  toast.dismiss('server-waking');
  return Promise.reject(error);
});

export interface StorageAuditPayload {
  storage_path: string;
  advisor_id: string;
  university_id: string;
  tenant_id?: string;
  matric_number?: string;
  curriculum_year?: string;
  program_code?: string;
}

export interface FinalizeApprovalPayload {
  document_id: string;
  matric_number: string;
  tenant_id?: string;
  student_name?: string;
  advisor_id?: string;
  university_id?: string;
  curriculum_year?: string;
  program_code?: string;
  academic_session?: string;
  semester?: string | number;
  pngk?: number;
  courses: Array<{
    course_code: string;
    course_name?: string;
    grade: string;
    credit_hour?: number;
    credits?: number;
    status?: string;
    warning?: string;
    session_semester?: string;
  }>;
}

export const api = {
  // Health check
  getHealth: async () => {
    const res = await apiClient.get('/api/v1/health');
    return res.data;
  },

  // Download Course CSV Starter Template
  downloadCourseTemplateCSV: async () => {
    const res = await apiClient.get('/api/v1/courses/template-csv', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'course_curriculum_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // Upload Course Structure CSV
  uploadCoursesCSV: async (
    file: File,
    templateName: string,
    programCode: string,
    totalCredits: number,
    syllabusYear: string
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('template_name', templateName);
    formData.append('program_code', programCode);
    formData.append('total_credits', String(totalCredits));
    formData.append('syllabus_year', syllabusYear);

    const res = await apiClient.post('/api/v1/courses/upload-csv', formData);
    return res.data;
  },

  // Extract PDF from storage path
  extractTranscript: async (filePath: string, tenantId?: string) => {
    const res = await apiClient.post('/api/v1/audit/extract', {
      file_path: filePath,
      ...(tenantId ? { tenant_id: tenantId } : {})
    });
    return res.data;
  },

  // Finalize approval through Zero-Waste FastAPI engine
  finalizeApproval: async (payload: FinalizeApprovalPayload) => {
    const res = await apiClient.post('/api/v1/audit/finalize-approval', payload);
    return res.data;
  },

  // Process PDF directly from Supabase Storage path
  processStorageAudit: async (payload: StorageAuditPayload) => {
    const res = await apiClient.post('/api/v1/audit/process-storage', payload);
    return res.data;
  },

  // Reject uploaded document via service-role backend endpoint
  rejectDocument: async (documentId: string, rejectionReason?: string) => {
    const res = await apiClient.post('/api/v1/audit/reject-document', {
      document_id: documentId,
      rejection_reason: rejectionReason || "Document rejected by advisor",
    });
    return res.data;
  },

  // Validate Cohort
  validateCohort: async (code: string) => {
    const res = await apiClient.get(`/api/v1/register/validate-cohort/${code}`);
    return res.data;
  },

  // Register Student
  registerStudent: async (payload: { cohort_code: string; matric_no: string; full_name: string }) => {
    const res = await apiClient.post('/api/v1/register/student', payload);
    return res.data;
  },

  // Register Advisor
  registerAdvisor: async (payload: { invite_code: string; full_name: string; staff_id: string; department: string }) => {
    const res = await apiClient.post('/api/v1/register/advisor', payload);
    return res.data;
  },

  // Notify Student of Advising Note
  notifyAdvisingLog: async (logId: string): Promise<{ sent: boolean; reason?: string; notified_at?: string }> => {
    const res = await apiClient.post(`/api/v1/advising-logs/${logId}/notify`);
    return res.data;
  },

  // Update Student Exemptions, Entry Semester, and EX/CT Course Records
  patchStudentExemptions: async (
    matricNo: string,
    payload: {
      entry_semester?: number;
      block_exempted_credits?: number;
      course_actions?: Array<{
        action: 'add' | 'remove';
        course_code: string;
        grade?: string;
        credits?: number;
        course_name?: string;
        semester?: string;
      }>;
    }
  ): Promise<{
    success: boolean;
    matric_no: string;
    entry_semester: number;
    block_exempted_credits: number;
    audits_written: number;
    detail: string;
  }> => {
    const res = await apiClient.patch(`/api/v1/students/${encodeURIComponent(matricNo)}/exemptions`, payload);
    return res.data;
  },
};


