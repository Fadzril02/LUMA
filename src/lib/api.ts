import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

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

  // Process PDF directly from Supabase Storage path
  processStorageAudit: async (payload: StorageAuditPayload) => {
    const res = await apiClient.post('/api/v1/audit/process-storage', payload);
    return res.data;
  },
};
