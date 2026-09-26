import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // 75 s — covers Render free-tier cold start (up to 60 s) plus actual request time
  timeout: 75000,
});

// Surface a clear message when the backend is cold-starting or unreachable
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
  return Promise.reject(error);
});

export interface StorageAuditPayload {
  storage_path: string;
  advisor_id: string;
  university_id: string;
  matric_number?: string;
  curriculum_year?: string;
  program_code?: string;
}

export interface FinalizeApprovalPayload {
  document_id: string;
  matric_number: string;
  student_name?: string;
  advisor_id?: string;
  university_id?: string;
  curriculum_year?: string;
  program_code?: string;
  academic_session?: string;
  semester?: string | number;
  courses: Array<{
    course_code: string;
    course_name?: string;
    grade: string;
    credit_hour?: number;
    credits?: number;
    status?: string;
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
    universityId: string,
    templateName: string,
    programCode: string,
    totalCredits: number
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('university_id', universityId);
    formData.append('template_name', templateName);
    formData.append('program_code', programCode);
    formData.append('total_credits', String(totalCredits));

    const res = await apiClient.post('/api/v1/courses/upload-csv', formData);
    return res.data;
  },

  // Extract PDF from storage path
  extractTranscript: async (filePath: string) => {
    const res = await apiClient.post('/api/v1/audit/extract', { file_path: filePath });
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
};

