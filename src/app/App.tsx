import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { StudentPortal } from './pages/student/StudentPortal';
import { AdvisorPortal } from './pages/advisor/AdvisorPortal';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { Toaster } from './components/ui/sonner';
import { ProtectedRoute } from './components/ProtectedRoute';

// ── Role-gated route wrapper ─────────────────────────────────────────────────
function RoleRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: 'student' | 'advisor' | 'admin';
}) {
  return <ProtectedRoute allowedRole={allowedRole}>{children}</ProtectedRoute>;
}

export default function App() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <Toaster />
      <BrowserRouter>
      <Routes>
        {/* ── Root / Login ────────────────────────────────────────────── */}
        {/* Both / and /login show LandingPage when unauthenticated or role unresolved. */}
        {/* Authenticated users with verified roles are redirected to their portal.     */}
        <Route
          path="/"
          element={
            user && role === 'advisor' ? (
              <Navigate to="/advisor" replace />
            ) : user && role === 'student' ? (
              <Navigate to="/student" replace />
            ) : user && !role ? (
              <LoadingScreen />
            ) : (
              <LandingPage />
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
    </>
  );
}