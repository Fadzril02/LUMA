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
  cohortCode: string;
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

export const extractMatricFromEmail = (email: string): string => {
  return email.split('@')[0].toUpperCase();
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

  const fetchUserProfile = async (currentUser: User): Promise<{ success: boolean; profile?: Profile; error?: Error }> => {
    try {
      const email = (currentUser.email || '').toLowerCase();
      
      // Check if user is a Student (via user metadata role)
      if (currentUser.user_metadata?.role === 'student') {
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
            return { success: true }; 
          }
          console.warn(`[AuthContext] BLOCKED GHOST STUDENT: user_id=${currentUser.id} has NO linked row in students table.`);
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          const blockError = new Error(
            'Access denied: Your student account is not initialized in the university database. Please contact your academic advisor.'
          );
          setAuthError(blockError.message);
          return { success: false, error: blockError };
        }

        // Construct profile exclusively from database columns
        const studentProfile: StudentProfile = {
          role: 'student',
          matric_no: data.matric_no,
          full_name: data.name,
          email: data.institutional_email,
          advisor_staff_id: data.advisor_staff_id,
          program: data.program,
          curriculum_year: data.syllabus_type,
          academic_status: data.academic_status,
          current_semester: data.current_semester,
          name: data.name,
          program_code: data.program,
          syllabus_type: data.syllabus_type,
        };

        setProfile(studentProfile);
        setAuthError(null);
        return { success: true, profile: studentProfile };
      }

      // Check if user is an Advisor
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
          tier: advisorData.tier || 'freemium',
          monthly_audit_count: advisorData.monthly_audit_count || 0,
          name: advisorData.name,
        };
        setProfile(advisorProfile);
        setAuthError(null);
        return { success: true, profile: advisorProfile };
      }

      // If neither student nor advisor found in database, reject session
      console.warn(`[AuthContext] BLOCKED UNRECOGNIZED USER: user_id=${currentUser.id}`);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      const unrecError = new Error('Access denied: Account not recognized.');
      setAuthError(unrecError.message);
      return { success: false, error: unrecError };

    } catch (err: any) {
      console.error('[AuthContext] fetchUserProfile fatal exception:', err);
      setUser(null);
      setSession(null);
      setProfile(null);
      return { success: false, error: err };
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
    let finalEmail = input.toLowerCase();

    if (!input.includes('@')) {
      // Look up student by matric_no to resolve their institutional email
      const { data: studentRow } = await supabase
        .from('students')
        .select('institutional_email')
        .eq('matric_no', input.toUpperCase())
        .maybeSingle();

      if (studentRow?.institutional_email) {
        finalEmail = studentRow.institutional_email.toLowerCase();
      }
    }

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

    const detectedRole: UserRole = profileRes.profile?.role ?? (data.user.user_metadata?.role === 'student' ? 'student' : 'advisor');
    return { error: null, role: detectedRole };
  };

  const signInStudent = async (matricNo: string, sessionCode: string) => {
    return await signInWithEmail(matricNo, sessionCode);
  };

  const signUpStudent = async (data: StudentRegistrationData) => {
    isRegistering.current = true;
    setIsLoading(true);
    const matricNo = data.matricNo.trim().toUpperCase();

    const matricRegex = /^[A-Z0-9]{5,15}$/i;
    if (!matricRegex.test(matricNo)) {
      isRegistering.current = false;
      setIsLoading(false);
      return { error: new Error("Invalid matric format. Expected format: 5-15 letters and numbers") };
    }

    const rawEmail = (data.institutionalEmail || data.email || '').trim().toLowerCase();
    if (!rawEmail || !rawEmail.includes('@')) {
      isRegistering.current = false;
      setIsLoading(false);
      return { error: new Error("Institutional email is required and must be a valid email address.") };
    }
    const finalEmail = rawEmail;
    const providedCode = (data.cohortCode || data.registrationCode || data.advisorId || '').trim().toUpperCase();

    // Validate that a cohort code was provided
    if (!providedCode) {
      isRegistering.current = false;
      setIsLoading(false);
      return { error: new Error("Please enter your 6-character Cohort Code.") };
    }

    try {
      // 1. Validation Update: Query cohorts table JOIN degree_templates where cohort_code = providedCode
      const { data: cohortRow, error: cohortLookupError } = await supabase
        .from('cohorts')
        .select(`
          id,
          cohort_name,
          cohort_code,
          is_locked,
          advisor_staff_id,
          template_id,
          degree_templates (
            program_code,
            program_name,
            syllabus_year
          )
        `)
        .eq('cohort_code', providedCode)
        .maybeSingle();

      // If the cohort is not found (or is locked, per RLS / is_locked flag), throw exact required error
      if (cohortLookupError || !cohortRow || cohortRow.is_locked === true) {
        if (cohortLookupError) {
          console.warn('[signUpStudent] Cohort lookup error:', cohortLookupError.message);
        }
        return { error: new Error("Invalid or locked Cohort Code.") };
      }

      // 2. Extract blueprint metadata from linked degree_templates
      const degreeTemplate = Array.isArray(cohortRow.degree_templates) 
        ? cohortRow.degree_templates[0] 
        : cohortRow.degree_templates;
      const programCode = (degreeTemplate as any)?.program_code || data.program || 'Unassigned';
      const syllabusYear = (degreeTemplate as any)?.syllabus_year || data.syllabusType || '2024/2025';
      const advisorStaffId = cohortRow.advisor_staff_id;
      const cohortId = cohortRow.id;

      // 3. Call supabase.auth.signUp, storing extracted program_code and syllabus_year in user metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password: data.password,
        options: {
          data: {
            role: 'student',
            matric_no: matricNo,
            full_name: data.fullName,
            advisor_staff_id: advisorStaffId,
            program: programCode,
            syllabus_type: syllabusYear,
            cohort_id: cohortId,
          },
        },
      });

      // 4. If signUp fails, return the error
      if (authError || !authData.user) {
        return { error: authError ?? new Error('Sign-up failed: no user returned.') };
      }

      // 5. Immediately execute INSERT into students table, including program, syllabus_type, advisor_staff_id, and cohort_id
      const { error: insertError } = await supabase.from('students').insert([
        {
          matric_no: matricNo,
          user_id: authData.user.id,
          name: data.fullName,
          institutional_email: finalEmail,
          advisor_staff_id: advisorStaffId,
          program: programCode,
          syllabus_type: syllabusYear,
          cohort_id: cohortId,
        },
      ]);

      // 6. If INSERT fails (duplicate matric, constraint violation),
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

      // 7. Re-fetch profile now that user_id and row are anchored in students
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
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("[AuthContext] Server-side logout failed, forcing local wipe:", error);
    } finally {
      // 1. Clear React State
      setUser(null);
      setProfile(null);
      setSession(null);
      setAuthError(null);

      // 2. Nuke ALL Local Storage (not just sb- keys)
      try {
        localStorage.clear();
      } catch (_) {}

      // 3. Nuke ALL Session Storage
      try {
        sessionStorage.clear();
      } catch (_) {}

      // 4. Nuke ALL Accessible Cookies
      try {
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      } catch (_) {}

      setIsLoading(false);
    }
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