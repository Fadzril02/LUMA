import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdvisorLogin } from '../pages/auth/AdvisorLogin';
import { AdvisorDashboard } from '../pages/advisor/AdvisorDashboard';
import { CohortSetup } from '../pages/advisor/CohortSetup';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-xs font-mono tracking-widest text-slate-400">
          INITIALIZING L.U.M.A. SECURE CONTEXT...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-xs font-mono tracking-widest text-slate-400">
          INITIALIZING L.U.M.A. SECURE CONTEXT...
        </span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route
          path="/login"
          element={!user ? <AdvisorLogin /> : <Navigate to="/advisor" replace />}
        />

        {/* Protected Advisor Triage Dashboard */}
        <Route
          path="/advisor"
          element={
            <ProtectedRoute>
              <AdvisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advisor/dashboard"
          element={
            <ProtectedRoute>
              <AdvisorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Cohort & Syllabus Setup */}
        <Route
          path="/advisor/setup"
          element={
            <ProtectedRoute>
              <CohortSetup />
            </ProtectedRoute>
          }
        />

        {/* Root Redirect */}
        <Route
          path="/"
          element={user ? <Navigate to="/advisor" replace /> : <Navigate to="/login" replace />}
        />

        {/* Catch-All */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}