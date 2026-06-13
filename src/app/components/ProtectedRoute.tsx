import React from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext"; // Adjust this path to where your AuthContext lives

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: string;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { profile, loading } = useAuth();

  // 1. Wait for Supabase to finish checking the database
  if (loading) {
    return (
      <div className="h-screen w-screen flex justify-center items-center bg-[#F8F9FA] font-mono text-[#990033] tracking-widest text-sm">
        VERIFYING SECURE CREDENTIALS...
      </div>
    );
  }

  // 2. If nobody is logged in, kick them back to the login screen
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // 3. If they are logged in, but are trying to access the WRONG portal, redirect them to their correct home
  if (profile.role !== allowedRole) {
    if (profile.role === 'Student') return <Navigate to="/student-portal" replace />;
    if (profile.role === 'Advisor') return <Navigate to="/advisor-portal" replace />;
    if (profile.role === 'Admin') return <Navigate to="/admin" replace />;
    
    // Total fallback if role is unrecognized
    return <Navigate to="/login" replace />;
  }

  // 4. If they pass all checks, open the doors!
  return <>{children}</>;
}