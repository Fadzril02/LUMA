import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { StudentPortal } from './pages/student/StudentPortal';
import { AdvisorPortal } from './pages/advisor/AdvisorPortal';
import { Loader2 } from 'lucide-react';

// ── Loading spinner ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
      <span className="text-xs font-mono tracking-widest text-slate-400">
        INITIALIZING L.U.M.A. SECURE CONTEXT...
      </span>
    </div>
  );
}

// ── Role-gated route wrapper ─────────────────────────────────────────────────
function RoleRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: 'student' | 'advisor' | 'admin';
}) {
  const { user, role, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (role && role !== allowedRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Root / Login ────────────────────────────────────────────── */}
        {/* Both / and /login show LandingPage when unauthenticated.      */}
        {/* Authenticated users are redirected to their portal.           */}
        <Route
          path="/"
          element={
            !user ? (
              <LandingPage />
            ) : role === 'student' ? (
              <Navigate to="/student" replace />
            ) : (
              <Navigate to="/advisor" replace />
            )
          }
        />
        {/* /login kept as alias for backwards-compat links */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        {/* /landing kept so deep-links still work */}
        <Route path="/landing" element={<LandingPage />} />

        {/* ── Student Portal ───────────────────────────────────────────── */}
        <Route
          path="/student"
          element={
            <RoleRoute allowedRole="student">
              <StudentPortal />
            </RoleRoute>
          }
        />
        <Route
          path="/student/*"
          element={
            <RoleRoute allowedRole="student">
              <StudentPortal />
            </RoleRoute>
          }
        />

        {/* ── Advisor Portal ───────────────────────────────────────────── */}
        <Route
          path="/advisor"
          element={
            <RoleRoute allowedRole="advisor">
              <AdvisorPortal />
            </RoleRoute>
          }
        />
        <Route
          path="/advisor/*"
          element={
            <RoleRoute allowedRole="advisor">
              <AdvisorPortal />
            </RoleRoute>
          }
        />

        {/* ── Catch-All ───────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}