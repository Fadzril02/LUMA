import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: string;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  // 1. Wait for Supabase to finish checking the database and session resolution
  if (loading) {
    return (
      <div className="h-screen w-screen flex justify-center items-center bg-[#F8F9FA] font-mono text-[#990033] tracking-widest text-sm">
        VERIFYING SECURE CREDENTIALS...
      </div>
    );
  }

  // 2. If nobody is logged in, kick them back to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Critical Fix: If loading is false, but user exists and profile is mysteriously null
  // (e.g., the profile fetch failed), do NOT leave it in an infinite loading state.
  // Force a fallback: redirect them to /login or an unauthorized route.
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // 4. If they are logged in, but are trying to access the WRONG portal, redirect them to their correct home
  const userRole = (profile.role || '').toLowerCase();
  const targetRole = allowedRole.toLowerCase();

  if (userRole !== targetRole) {
    if (userRole === 'student') return <Navigate to="/student" replace />;
    if (userRole === 'advisor') return <Navigate to="/advisor" replace />;
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    
    // Total fallback if role is unrecognized
    return <Navigate to="/login" replace />;
  }

  // 5. If they pass all checks, open the doors!
  return <>{children}</>;
}