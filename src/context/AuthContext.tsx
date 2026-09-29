import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ==============================================================================
// 1. Strict TypeScript Interfaces
// ==============================================================================

export type UserRole = 'student' | 'advisor' | null;

export interface BaseProfile {
  role: UserRole;
  tenant_id?: string;
}

export interface StudentProfile extends BaseProfile {
  role: 'student';
  matric_no: string;
  advisor_staff_id: string;
  full_name: string;
  curriculum_year: string;
  program_code: string;
  // UI aliases and student attributes for backwards compatibility
  email?: string;
  institutional_email?: string;
  academic_status?: string;
  current_semester?: string;
  name?: string;
  program?: string;
  syllabus_type?: string;
}

export interface AdvisorProfile extends BaseProfile {
  role: 'advisor';
  staff_id: string;
  full_name: string;
  email: string;
  department?: string;
  university_id?: string;
  tenant_id?: string;
  tier?: 'freemium' | 'pro' | 'department' | 'enterprise';
  monthly_audit_count?: number;
  // UI alias for backwards compatibility
  name?: string;
}

export type Profile = StudentProfile | AdvisorProfile | null;

export interface StudentRegistrationData {
  fullName: string;
  password: string;
  matricNo?: string;
  cohortCode?: string;
  institutionalEmail?: string;
  email?: string;
  registrationCode?: string; // backwards compatibility alias
  advisorId?: string; // backwards compatibility alias
  program?: string;
  syllabusType?: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile;
  advisor: AdvisorProfile | null;
  student: StudentProfile | null;
  role: UserRole;
  authError: string | null;
  clearAuthError: () => void;
  isLoading: boolean;
  loading: boolean; // Backwards-compatible alias for isLoading
  signInWithEmail: (email: string, passwordOrSessionCode: string) => Promise<{ error: Error | null; role?: UserRole }>;
  signInStudent: (matricNo: string, sessionCode: string) => Promise<{ error: Error | null }>;
  signUpStudent: (data: StudentRegistrationData) => Promise<{ error: Error | null }>;
  signUpAdvisor: (data: {
    email: string;
    password: string;
    fullName: string;
    staffId?: string;
    universityId?: string;
    department?: string;
    inviteCode?: string;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>; // Backwards-compatible alias for signOut
  refreshProfile: () => Promise<void>;
  refreshAdvisorProfile: () => Promise<void>; // Backwards-compatible alias
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==============================================================================
// 2. Helper Functions
// ==============================================================================

export const extractMatricFromEmail = (email: string): string => {
  return email.split('@')[0].toUpperCase();
};

// ==============================================================================
// 3. AuthProvider Implementation
// ==============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isRegistering = useRef(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  const fetchUserProfile = async (currentUser: User): Promise<{ success: boolean; profile?: Profile; error?: Error }> => {
    try {
      const email = (currentUser.email || '').toLowerCase();
      
      // 1. Check if user is a Student
      const { data: studentData, error: uidErr } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (uidErr) {
        console.warn('[AuthContext] Student lookup error:', uidErr.message);
      }

      if (studentData) {
        // Construct profile exclusively from database columns
        const studentProfile: StudentProfile = {
          role: 'student',
          matric_no: studentData.matric_no,
          full_name: studentData.name,
          email: studentData.institutional_email,
          advisor_staff_id: studentData.advisor_staff_id,
          program: studentData.program,
          curriculum_year: studentData.syllabus_type,
          academic_status: studentData.academic_status,
          current_semester: studentData.current_semester,
          name: studentData.name,
          program_code: studentData.program,
          syllabus_type: studentData.syllabus_type,
        };

        setProfile(studentProfile);
        setAuthError(null);
        return { success: true, profile: studentProfile };
      }

      // 2. Check if user is an Advisor
      const { data: advisorData, error: advErr } = await supabase
        .from('advisors')
        .select('*')
        .or(`user_id.eq.${currentUser.id},institutional_email.eq.${email}`)
        .maybeSingle();

      if (advErr) {
        console.warn('[AuthContext] Advisor lookup error:', advErr.message);
      }

      if (advisorData) {
        const advisorProfile: AdvisorProfile = {
          role: 'advisor',
          staff_id: advisorData.staff_id,
          full_name: advisorData.name,
          email: advisorData.institutional_email,
          department: advisorData.department,
          university_id: advisorData.university_id,
          tenant_id: advisorData.tenant_id || advisorData.university_id,
          tier: advisorData.tier || 'freemium',
          monthly_audit_count: advisorData.monthly_audit_count || 0,
          name: advisorData.name,
        };
        setProfile(advisorProfile);
        setAuthError(null);
        return { success: true, profile: advisorProfile };
      }

      // 3. User has no students or advisors row yet (needs to complete registration)
      setProfile(null);
      setAuthError(null);
      return { success: true, profile: null };
    } catch (err: any) {
      console.warn('[AuthContext] fetchUserProfile exception during profile lookup:', err);
      setAuthError('An error occurred while loading your profile.');
      return { success: false, error: new Error('An error occurred while loading your profile.') };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const failsafeTimer = setTimeout(() => {
      setIsLoading(false);
      setIsInitializing(false);
    }, 3000);

    // 1. Initial Session Retrieval via getSession() with explicit .then() and .catch()
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error: sessionErr }) => {
        if (!isMounted) return;
        
        try {
          if (sessionErr) {
            console.warn('[AuthContext] getSession error — treating as unauthenticated:', sessionErr.message);
            setSession(null);
            setUser(null);
            setProfile(null);
            return;
          }

          if (!initialSession?.user) {
            setSession(null);
            setUser(null);
            setProfile(null);
            return;
          }

          // Restore session and user optimistically
          setSession(initialSession);
          setUser(initialSession.user);

          await fetchUserProfile(initialSession.user);
        } catch (profileErr) {
          console.error('[AuthContext] fetchUserProfile error during session restore:', profileErr);
        } finally {
          // Unconditional loading completion in .then()
          if (isMounted) {
            setIsLoading(false);
            setIsInitializing(false);
          }
          clearTimeout(failsafeTimer);
        }
      })
      .catch((err) => {
        console.error('[AuthContext] getSession .catch handler error:', err);
        // Unconditional loading completion in .catch()
        if (isMounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          setIsInitializing(false);
        }
        clearTimeout(failsafeTimer);
      });

    // 2. Auth state change listener handling all events ('INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        try {
          switch (event) {
            case 'SIGNED_OUT': {
              setSession(null);
              setUser(null);
              setProfile(null);
              setAuthError(null);
              break;
            }

            case 'INITIAL_SESSION':
            case 'SIGNED_IN': {
              if (currentSession?.user) {
                setSession(currentSession);
                setUser(currentSession.user);
                if (!isRegistering.current) {
                  await fetchUserProfile(currentSession.user);
                }
              } else {
                setSession(null);
                setUser(null);
                setProfile(null);
              }
              break;
            }

            case 'TOKEN_REFRESHED': {
              if (currentSession?.user) {
                setSession(currentSession);
                setUser(currentSession.user);
              }
              break;
            }

            default: {
              if (currentSession?.user) {
                setSession(currentSession);
                setUser(currentSession.user);
              }
              break;
            }
          }
        } catch (err) {
          console.error(`[AuthContext] onAuthStateChange ${event} error:`, err);
        } finally {
          // Unconditional loading completion across ALL auth events
          if (isMounted) {
            setIsLoading(false);
            setIsInitializing(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(failsafeTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, passwordOrSessionCode: string) => {
    setIsLoading(true);
    setAuthError(null);
    const finalEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: finalEmail,
      password: passwordOrSessionCode,
    });

    if (error || !data.user) {
      setIsLoading(false);
      return { error: error ?? new Error('Sign in failed.') };
    }

    // Immediately verify and require the real DB-linked row
    const profileRes = await fetchUserProfile(data.user);
    setIsLoading(false);

    if (!profileRes.success) {
      return { 
        error: profileRes.error ?? new Error('Your account exists but is not linked to a valid record. Please contact your advisor.') 
      };
    }

    const detectedRole: UserRole = profileRes.profile?.role ?? null;
    return { error: null, role: detectedRole };
  };

  const signInStudent = async (matricNo: string, sessionCode: string) => {
    return await signInWithEmail(matricNo, sessionCode);
  };

  const signUpStudent = async (data: StudentRegistrationData) => {
    isRegistering.current = true;
    setIsLoading(true);

    try {
      const finalEmail = (data.institutionalEmail || data.email || '').trim().toLowerCase();
      if (!finalEmail) {
        return { error: new Error('Email is required.') };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (authError || !authData.user) {
        return { error: authError ?? new Error('Sign-up failed: no user returned.') };
      }

      return { error: null };
    } catch (err: any) {
      console.error('[signUpStudent] Unexpected registration failure:', err);
      return {
        error: err instanceof Error ? err : new Error(err?.message || 'Unexpected sign-up failure.'),
      };
    } finally {
      isRegistering.current = false;
      setIsLoading(false);
    }
  };

  const signUpAdvisor = async (data: {
    email: string;
    password: string;
    fullName: string;
    staffId?: string;
    universityId?: string;
    department?: string;
    inviteCode?: string;
  }) => {
    isRegistering.current = true;
    setIsLoading(true);

    try {
      const finalEmail = data.email.trim().toLowerCase();
      if (!finalEmail) {
        return { error: new Error('Email is required.') };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (authError || !authData.user) {
        return { error: authError ?? new Error('Advisor sign-up failed: no user returned.') };
      }

      return { error: null };
    } catch (err: any) {
      console.error('[signUpAdvisor] Unexpected registration failure:', err);
      return {
        error: err instanceof Error ? err : new Error(err?.message || 'Unexpected advisor sign-up failure.'),
      };
    } finally {
      isRegistering.current = false;
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // 1. Synchronously nuke ALL Local Storage (including auth tokens & degree templates)
    try {
      localStorage.clear();
    } catch (_) {}

    // 2. Synchronously nuke ALL Session Storage (including syngrad_degree_templates cache)
    try {
      sessionStorage.removeItem("syngrad_degree_templates");
      sessionStorage.removeItem("luma_degree_templates");
      sessionStorage.clear();
    } catch (_) {}

    // 3. Synchronously nuke ALL accessible cookies
    try {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    } catch (_) {}

    // 4. Immediately flip React State BEFORE awaiting network call to prevent sluggish UX
    setUser(null);
    setSession(null);
    setProfile(null);
    setAuthError(null);
    setIsLoading(false);

    // 5. Fire-and-await server-side logout without blocking UI transition
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("[AuthContext] Server-side logout failed:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  const currentRole: UserRole =
    profile?.role ??
    (user?.app_metadata?.role as UserRole) ??
    null;
  const advisorProfile = profile?.role === 'advisor' ? (profile as AdvisorProfile) : null;
  const studentProfile = profile?.role === 'student' ? (profile as StudentProfile) : null;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
          Initializing L.U.M.A. Secure Session...
        </span>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        advisor: advisorProfile,
        student: studentProfile,
        role: currentRole,
        authError,
        clearAuthError,
        isLoading,
        loading: isLoading,
        signInWithEmail,
        signInStudent,
        signUpStudent,
        signUpAdvisor,
        signOut,
        logout: signOut,
        refreshProfile,
        refreshAdvisorProfile: refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}