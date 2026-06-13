import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ✨ Real Components (Ensure these paths match your actual folder structure)
import { LandingPage } from './pages/LandingPage'; 
import { StudentPortal } from './pages/student/StudentPortal';
import { Showcase } from './pages/Showcase';
import { AdvisorPortal } from './pages/advisor/AdvisorPortal'; 
import { AdminPortal } from './pages/admin/AdminPortal';

export default function App() {
  const { user, role, loading } = useAuth();

  // 1. Loading State (Fires while Supabase verifies the session)
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
        {/* 🚪 Login / Landing Page */}
        <Route 
          path="/login" 
          element={
            !user ? <LandingPage /> : 
            role ? <Navigate to={`/${role}/dashboard`} replace /> :
            <Navigate to="/unassigned" replace />
          } 
        />
        
        {/* 🌐 Public Route (No auth required) */}
        <Route 
          path="/showcase" 
          element={<Showcase />} 
        />
        
        {/* 🎓 SECURED: Student Portal */}
        <Route 
          path="/student/dashboard" 
          element={user && role === 'student' ? <StudentPortal /> : <Navigate to="/login" replace />} 
        />

        {/* 🛡️ SECURED: Advisor Portal */}
        <Route 
          path="/advisor/dashboard" 
          element={user && role === 'advisor' ? <AdvisorPortal /> : <Navigate to="/login" replace />} 
        />

        {/* 👑 SECURED: Admin Portal */}
        <Route 
          path="/admin/dashboard" 
          element={user && role === 'admin' ? <AdminPortal /> : <Navigate to="/login" replace />} 
        />
        
        {/* 🛑 The Catch-All Bouncer (Handles missing roles or 404 URLs) */}
        <Route 
          path="*" 
          element={
            !user ? <Navigate to="/login" replace /> : 
            role ? <Navigate to={`/${role}/dashboard`} replace /> : 
            <div className="flex h-screen items-center justify-center bg-slate-950 text-rose-500 font-mono text-sm tracking-widest text-center px-6 leading-relaxed">
              <div>
                <p className="mb-2 font-bold text-base">ERROR: INSTITUTIONAL EMAIL NOT RECOGNIZED IN MASTER DATABASE.</p>
                <p>PLEASE CONTACT ADMIN TO ASSIGN A ROLE.</p>
              </div>
            </div>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}