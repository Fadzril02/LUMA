import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ==============================================================================
// 1. Strict TypeScript Interfaces
// ==============================================================================

export type UserRole = 'student' | 'advisor' | null;

export interface BaseProfile {
  role: UserRole;
}

export interface StudentProfile extends BaseProfile {
  role: 'student';
  matric_no: string;
  advisor_staff_id: string;
  full_name: string;
  curriculum_year: string;
  program_code: string;
  // UI aliases for backwards compatibility
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
  tier?: 'freemium' | 'pro' | 'department' | 'enterprise';
  monthly_audit_count?: number;
  // UI alias for backwards compatibility
  name?: string;
}

export type Profile = StudentProfile | AdvisorProfile | null;

export interface StudentRegistrationData {
  matricNo: string;
  fullName: string;
  password: string;
  advisorId: string;
  program: string;
  syllabusType: string;
  email?: string;
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
  signInWithEmail: (emailOrMatric: string, passwordOrSessionCode: string) => Promise<{ error: Error | null; role?: UserRole }>;
  signInStudent: (matricNo: string, sessionCode: string) => Promise<{ error: Error | null }>;
  signUpStudent: (data: StudentRegistrationData) => Promise<{ error: Error | null }>;
  signUpAdvisor: (data: {
    email: string;
    password: string;
    fullName: string;
    staffId: string;
    universityId?: string;
    department?: string;
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

export const toStudentEmail = (matricNo: string): string => {
  const clean = matricNo.trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@student.utm.my`;
};

export const extractMatricFromEmail = (email: string): string => {
  return email.split('@')[0].toUpperCase();
};

export const isStudentEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.toLowerCase().endsWith('@student.utm.my') || email.toLowerCase().endsWith('@graduate.utm.my');
};

// ==============================================================================
// 3. AuthProvider Implementation
// ==============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isRegistering = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  const fetchUserProfile = async (currentUser: User): Promise<{ success: boolean; profile?: Profile; error?: Error } | void> => {
    try {
      const email = (currentUser.email || '').toLowerCase();
      
      // Check if user is a Student (via @student.utm.my domain or user metadata)
      if (isStudentEmail(email) || currentUser.user_metadata?.role === 'student') {
        // Query students strictly WHERE user_id = auth.uid()
        const { data, error: uidErr } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (uidErr) {
          console.warn('[AuthContext] Student lookup error:', uidErr.message);
        }

        // STEP 2 FIX: Hard failure if no linked student row exists.
        // NEVER construct a fake profile from user_metadata.
        if (!data) {
          if (isRegistering.current) {
            console.log("[AuthContext] Registration in progress, bypassing ghost check.");
            return; 
          }
          console.warn(`[AuthContext] BLOCKED GHOST STUDENT: user_id=${currentUser.id} has NO linked row in students table.`);
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          const notLinkedError = new Error('Your account exists but is not linked to a valid record. Please contact your advisor.');
          setAuthError(notLinkedError.message);
          return { success: false, error: notLinkedError };
        }

        // Real students row found: ALL displayed data MUST come strictly from this DB row
        const studentProfile: StudentProfile = {
          role: 'student',
          matric_no: data.matric_no,
          advisor_staff_id: data.advisor_staff_id || '',
          full_name: data.name || data.matric_no,
          curriculum_year: data.syllabus_type || '',
          program_code: data.program || '',
          name: data.name || data.matric_no,
          program: data.program || '',
          syllabus_type: data.syllabus_type || '',
        };

        setProfile(studentProfile);
        setAuthError(null);
        return { success: true, profile: studentProfile };
      } else {
        // Advisor: Query advisors table
        let { data, error } = await supabase
          .from('advisors')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        // Fallback: check by institutional_email if user_id is not yet set
        if (!data && email) {
          const { data: byEmail, error: emailErr } = await supabase
            .from('advisors')
            .select('*')
            .eq('institutional_email', email)
            .maybeSingle();
          if (byEmail) {
            data = byEmail;
            if (!byEmail.user_id) {
              await supabase.from('advisors').update({ user_id: currentUser.id }).eq('staff_id', byEmail.staff_id);
            }
          }
          if (emailErr) {
            console.warn('[AuthContext] Advisor email lookup error:', emailErr.message);
          }
        }

        if (error) {
          console.warn('[AuthContext] Advisor record lookup error:', error.message);
        }

        // STEP 2 FIX: Hard failure if no linked advisor row exists.
        // NEVER construct a fake profile from user_metadata.
        if (!data) {
          if (isRegistering.current) {
            console.log("[AuthContext] Registration in progress, bypassing ghost check.");
            return;
          }
          console.warn(`[AuthContext] BLOCKED GHOST ADVISOR: user_id=${currentUser.id} has NO linked row in advisors table.`);
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          const notLinkedError = new Error('Your account exists but is not linked to a valid record. Please contact your advisor.');
          setAuthError(notLinkedError.message);
          return { success: false, error: notLinkedError };
        }

        // Real advisors row found: ALL data MUST come strictly from this DB row
        const advisorProfile: AdvisorProfile = {
          role: 'advisor',
          staff_id: data.staff_id,
          full_name: data.name || 'Academic Advisor',
          email: data.institutional_email || currentUser.email || '',
          department: data.department || '',
          university_id: data.university_id,
          tier: data.tier || 'freemium',
          monthly_audit_count: data.monthly_audit_count || 0,
          name: data.name || 'Academic Advisor',
        };

        setProfile(advisorProfile);
        setAuthError(null);
        return { success: true, profile: advisorProfile };
      }
    } catch (err: any) {
      console.error('Error fetching profile in AuthProvider:', err);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      const error = new Error('Your account exists but is not linked to a valid record. Please contact your advisor.');
      setAuthError(error.message);
      return { success: false, error };
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setSession(session);
        setUser(session.user);
        await fetchUserProfile(session.user);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (emailOrMatric: string, passwordOrSessionCode: string) => {
    setIsLoading(true);
    setAuthError(null);
    const input = emailOrMatric.trim();
    const isEmail = input.includes('@');
    const finalEmail = isEmail ? input.toLowerCase() : toStudentEmail(input);

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

    const detectedRole: UserRole = profileRes.profile?.role ?? (isStudentEmail(finalEmail) ? 'student' : 'advisor');
    return { error: null, role: detectedRole };
  };

  const signInStudent = async (matricNo: string, sessionCode: string) => {
    const studentEmail = toStudentEmail(matricNo);
    const result = await signInWithEmail(studentEmail, sessionCode);
    return { error: result.error };
  };

  const signUpStudent = async (data: StudentRegistrationData) => {
    isRegistering.current = true;
    setIsLoading(true);
    const matricNo = data.matricNo.trim().toUpperCase();
    const finalEmail = data.email?.trim() ? data.email.trim().toLowerCase() : toStudentEmail(matricNo);
    const advisorStaffId = (data.advisorId || '').trim().toUpperCase();

    // Strict validation: Program Code and Syllabus Year are required to register
    if (!data.program || !data.syllabusType) {
      isRegistering.current = false;
      setIsLoading(false);
      return { error: new Error("Program Code and Syllabus Year are required to register.") };
    }

    // Validate that a session code was provided
    if (!advisorStaffId) {
      isRegistering.current = false;
      setIsLoading(false);
      return { error: new Error('Please provide your Lecturer Session Code.') };
    }

    try {
      // 1. Call supabase.auth.signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password: data.password,
        options: {
          data: {
            role: 'student',
            matric_no: matricNo,
            full_name: data.fullName,
            advisor_staff_id: advisorStaffId,
            program: data.program,
            syllabus_type: data.syllabusType,
          },
        },
      });

      // 2. If signUp fails, return the error
      if (authError || !authData.user) {
        return { error: authError ?? new Error('Sign-up failed: no user returned.') };
      }

      // 3. Immediately execute INSERT into students table using returned authData.user.id
      const { error: insertError } = await supabase.from('students').insert([
        {
          matric_no: matricNo,
          user_id: authData.user.id,
          name: data.fullName,
          institutional_email: finalEmail,
          advisor_staff_id: advisorStaffId,
          program: data.program,
          syllabus_type: data.syllabusType,
        },
      ]);

      // 4. If INSERT fails (duplicate matric, invalid session code, constraint violation),
      // signOut immediately so the user is never left in an unlinked ghost state
      if (insertError) {
        console.error('[signUpStudent] Student record INSERT failed:', insertError.message);
        await supabase.auth.signOut();
        return {
          error: new Error(
            insertError.message.includes('duplicate') || insertError.message.includes('unique')
              ? `Matric number "${matricNo}" is already registered.`
              : `Registration failed (database error): ${insertError.message}`
          ),
        };
      }

      // 5. Re-fetch profile now that user_id and row are anchored in students
      await fetchUserProfile(authData.user);
      return { error: null };
    } catch (err: any) {
      console.error('[signUpStudent] Unexpected registration failure:', err);
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.error('[signUpStudent] Cleanup signOut failed:', signOutErr);
      }
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
    staffId: string;
    universityId?: string;
    department?: string;
  }) => {
    setIsLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: {
        data: {
          role: 'advisor',
          staff_id: data.staffId,
          full_name: data.fullName,
        },
      },
    });

    if (authError || !authData.user) {
      setIsLoading(false);
      return { error: authError };
    }

    // Insert/Upsert Advisor Profile in advisors table
    // NOTE: The advisors table RLS has no insert policy for self-registration.
    // We use service_role bypass is not available here, so we attempt the upsert
    // and explicitly return the error if it fails (not swallowed silently).
    const { error: dbError } = await supabase.from('advisors').upsert({
      staff_id: data.staffId,
      name: data.fullName,
      institutional_email: data.email.trim().toLowerCase(),
      department: data.department || 'Computer Science',
    }, { onConflict: 'staff_id' });

    if (dbError) {
      console.error('[signUpAdvisor] DB upsert failed:', dbError.message);
      // Auth user was created but DB row failed — sign out to avoid orphan session
      await supabase.auth.signOut();
      setIsLoading(false);
      return {
        error: new Error(
          `Account created but profile could not be saved: ${dbError.message}. ` +
          `Please contact your administrator.`
        ),
      };
    }

    await fetchUserProfile(authData.user);
    setIsLoading(false);
    return { error: null };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setAuthError(null);
    setIsLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  const currentRole: UserRole = profile?.role ?? null;
  const advisorProfile = profile?.role === 'advisor' ? (profile as AdvisorProfile) : null;
  const studentProfile = profile?.role === 'student' ? (profile as StudentProfile) : null;

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