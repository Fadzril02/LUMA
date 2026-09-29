import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: string;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, profile, loading, authError, refreshProfile, signOut } = useAuth();

  // 1. Wait for Supabase to finish checking the database and session resolution
  if (loading) {
    return (
      <div className="h-screen w-screen flex justify-center items-center bg-[#F8F9FA] font-mono text-[#990033] tracking-widest text-sm">
        VERIFYING SECURE CREDENTIALS...
      </div>
    );
  }

  // 2. If authError is set → render an error screen with the message, a "Retry" button (refreshProfile) plus "Sign out"
  if (authError) {
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-[#F8F9FA] p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-rose-100 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900">Authentication Error</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{authError}</p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => refreshProfile()}
              className="flex-1 py-2.5 px-4 bg-[#990033] hover:bg-[#80002A] text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. If nobody is logged in, kick them back to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 4. Only redirect to /complete-registration when there's no profile AND no authError
  if (!profile) {
    return <Navigate to="/complete-registration" replace />;
  }

  // 4. If they are logged in, but are trying to access the WRONG portal, redirect them to their correct home
  const userRole = (profile.role || '').toLowerCase();
  const targetRole = allowedRole.toLowerCase();

  if (userRole !== targetRole) {
    if (userRole === 'student') return <Navigate to="/student" replace />;
    if (userRole === 'advisor') return <Navigate to="/advisor" replace />;
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    
    // Total fallback if role is unrecognized
    return <Navigate to="/complete-registration" replace />;
  }

  // 5. If they pass all checks, open the doors!
  return <>{children}</>;
}