import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ✨ Real Components
import { LandingPage } from './pages/LandingPage'; 
import { StudentPortal } from './pages/student/StudentPortal';
import { Showcase } from './pages/Showcase';
import AdvisorDashboard from './pages/advisor/AdvisorDashboard';
import { AdminPortal } from './pages/admin/AdminPortal';
import { StudentsList } from './pages/advisor/StudentsList';
import { UploadResults } from './pages/advisor/UploadResults';
import { CorrectionsQueue } from './pages/advisor/CorrectionsQueue';

// 🚧 Admin Placeholder (Keep this until we build the real Admin portal)
const AdminDashboard = () => {
  const { profile, logout } = useAuth();
  return (
    <div className="p-8 text-white bg-slate-950 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto border border-slate-800 bg-slate-900/40 p-6 rounded-2xl">
        <h1 className="text-xl font-bold text-amber-400 mb-2">System Administration Control Desk</h1>
        <p className="text-sm text-slate-400 mb-6">Security Context Profile: {profile?.name || 'System Operator'}</p>
        <button onClick={logout} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold hover:bg-rose-500/20 hover:text-rose-400 transition-all cursor-pointer">Terminate Session (Logout)</button>
      </div>
    </div>
  );
};

export default function App() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-emerald-400 font-mono text-xs tracking-widest">
        SYNCHRONIZING ENTERPRISE SECURITY CONTEXT...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <LandingPage /> : <Navigate to={`/${role}/dashboard`} replace />} 
        />
        
        <Route 
          path="/showcase" 
          element={<Showcase />} 
        />
        
        {/* 🎓 Student Dashboard */}
        <Route 
          path="/student/dashboard" 
          element={user && role === 'student' ? <StudentPortal /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="/advisor/dashboard" 
          element={user && role === 'advisor' ? <AdvisorDashboard /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="/advisor/students" 
          element={user && role === 'advisor' ? <StudentsList /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/advisor/upload" 
          element={user && role === 'advisor' ? <UploadResults /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/advisor/corrections" 
          element={user && role === 'advisor' ? <CorrectionsQueue /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/admin/dashboard" 
          element={user && role === 'admin' ? <AdminPortal /> : <Navigate to="/login" replace />} 
        />
        
       {/* 🛡️ The Catch-All Bouncer */}
       <Route 
          path="*" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            role ? <Navigate to={`/${role}/dashboard`} replace /> : 
            <div className="flex h-screen items-center justify-center bg-slate-950 text-rose-500 font-mono text-sm tracking-widest text-center px-6">
              ERROR: INSTITUTIONAL EMAIL NOT RECOGNIZED IN MASTER DATABASE.<br/>
              PLEASE CONTACT ADMIN TO ASSIGN A ROLE.
            </div>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}