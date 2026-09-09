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

// Automatically attach Supabase JWT token to outgoing API requests
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
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
  uploadCoursesCSV: async (file: File, universityId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('university_id', universityId);

    const res = await apiClient.post('/api/v1/courses/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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

