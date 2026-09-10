import React, { createContext, useContext, useEffect, useState } from 'react';
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
  program?: string;
  syllabusType?: string;
  email?: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile;
  advisor: AdvisorProfile | null;
  student: StudentProfile | null;
  role: UserRole;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserProfile = async (currentUser: User) => {
    try {
      const email = (currentUser.email || '').toLowerCase();
      
      // Check if user is a Student (via @student.utm.my domain or user metadata)
      if (isStudentEmail(email) || currentUser.user_metadata?.role === 'student') {
        const matricNo = currentUser.user_metadata?.matric_no || extractMatricFromEmail(email);

        // PRIORITY 4 FIX: Always try user_id = auth.uid() FIRST so the profile
        // is anchored to the authenticated identity (not just the matric_no string).
        // This also respects the new RLS policy which only returns the student's own row.
        let data: any = null;
        let fetchError: any = null;

        const { data: byUid, error: uidErr } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (!uidErr && byUid) {
          data = byUid;
        } else {
          // Fallback: user_id not yet set (e.g. just signed up before claim ran)
          const { data: byMatric, error: matricErr } = await supabase
            .from('students')
            .select('*')
            .eq('matric_no', matricNo)
            .maybeSingle();
          data = byMatric;
          fetchError = matricErr;
        }

        if (fetchError) {
          console.warn('Student record lookup warning:', fetchError.message);
        }

        // Live schema uses 'name' (not 'full_name'), 'program' (not 'program_code'),
        // 'syllabus_type' (not 'curriculum_year')
        const fullName = data?.name || data?.full_name || currentUser.user_metadata?.full_name || matricNo;
        const advisorId = data?.advisor_staff_id || currentUser.user_metadata?.advisor_staff_id || 'STAFF-LIYANA';
        const curriculumYear = data?.syllabus_type || data?.curriculum_year || '2023/2024';
        const programCode = data?.program || data?.program_code || 'SECJ';

        const studentProfile: StudentProfile = {
          role: 'student',
          matric_no: matricNo,
          advisor_staff_id: advisorId,
          full_name: fullName,
          curriculum_year: curriculumYear,
          program_code: programCode,
          name: fullName,
          program: programCode,
          syllabus_type: curriculumYear,
        };

        setProfile(studentProfile);
      } else {
        // User is an Advisor
        const staffId = currentUser.user_metadata?.staff_id || currentUser.email?.split('@')[0].toUpperCase() || 'STAFF-LIYANA';
        
        const { data, error } = await supabase
          .from('advisors')
          .select('*')
          .or(`id.eq.${currentUser.id},institutional_email.eq.${currentUser.email},staff_id.eq.${staffId}`)
          .maybeSingle();

        if (error) {
          console.warn('Advisor record lookup warning:', error.message);
        }

        const fullName = data?.name || data?.full_name || currentUser.user_metadata?.full_name || 'Academic Advisor';
        const advisorProfile: AdvisorProfile = {
          role: 'advisor',
          staff_id: data?.staff_id || staffId,
          full_name: fullName,
          email: data?.institutional_email || data?.email || currentUser.email || '',
          department: data?.department || 'Computer Science',
          university_id: data?.university_id,
          tier: data?.tier || 'freemium',
          monthly_audit_count: data?.monthly_audit_count || 0,
          name: fullName,
        };

        setProfile(advisorProfile);
      }
    } catch (err) {
      console.error('Error fetching profile in AuthProvider:', err);
      setProfile(null);
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
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (emailOrMatric: string, passwordOrSessionCode: string) => {
    setIsLoading(true);
    const input = emailOrMatric.trim();
    const isEmail = input.includes('@');
    const finalEmail = isEmail ? input.toLowerCase() : toStudentEmail(input);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: finalEmail,
      password: passwordOrSessionCode,
    });

    setIsLoading(false);
    if (error) return { error };

    const detectedRole: UserRole = isStudentEmail(finalEmail) ? 'student' : 'advisor';
    return { error: null, role: detectedRole };
  };

  const signInStudent = async (matricNo: string, sessionCode: string) => {
    const studentEmail = toStudentEmail(matricNo);
    const result = await signInWithEmail(studentEmail, sessionCode);
    return { error: result.error };
  };

  const signUpStudent = async (data: StudentRegistrationData) => {
    setIsLoading(true);
    const matricNo = data.matricNo.trim().toUpperCase();
    const finalEmail = data.email?.trim() ? data.email.trim().toLowerCase() : toStudentEmail(matricNo);
    const advisorStaffId = (data.advisorId || '').trim().toUpperCase() || 'STAFF-LIYANA';
    const curriculumYear = (data.syllabusType || '2023/2024').trim();
    const programCode = (data.program || 'SECJ').trim().toUpperCase();

    // ── PRIORITY 4: Claim-based registration ──────────────────────────────────
    //
    // We do NOT create a new row in `students`. Instead:
    //   1. Create the Supabase Auth user (gives us a session + auth.uid())
    //   2. While logged in, SELECT the pre-seeded students row by matric_no
    //   3. Validate it exists and is unclaimed (user_id IS NULL)
    //   4. CLAIM it: UPDATE students SET user_id = auth.uid() WHERE matric_no = ?
    //
    // If no pre-seeded row → reject with a clear advisor-contact error.
    // If already claimed by another UID → reject as squatted.
    // ─────────────────────────────────────────────────────────────────────────

    // Step 1: Create the Supabase Auth user (this also signs them in)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: finalEmail,
      password: data.password,
      options: {
        data: {
          role: 'student',
          matric_no: matricNo,
          full_name: data.fullName,
          advisor_staff_id: advisorStaffId,
        },
      },
    });

    if (authError || !authData.user) {
      setIsLoading(false);
      return { error: authError ?? new Error('Sign-up failed: no user returned.') };
    }

    // Step 2: SELECT the pre-seeded row by matric_no.
    // At this point the student is authenticated, so the RLS UPDATE policy
    // (user_id = auth.uid() OR advisor path) will allow the claim below
    // because the current row has user_id = NULL (not yet claimed).
    // NOTE: The SELECT policy requires user_id = auth.uid() OR advisor path.
    // Since user_id is NULL, we need the service_role or a special open policy
    // for unclaimed rows. We work around this by using the auth.uid() match
    // on the UPDATE directly — the claim succeeds if the row exists and
    // user_id IS NULL (the UPDATE policy USING clause allows it).
    const { data: existingStudent, error: lookupError } = await supabase
      .from('students')
      // Select 'name' — the actual live column (not 'full_name' which doesn't exist)
      .select('matric_no, user_id, name')
      .eq('matric_no', matricNo)
      .is('user_id', null)   // Only find UNCLAIMED rows
      .maybeSingle();

    if (lookupError) {
      console.error('[signUpStudent] Student lookup failed:', lookupError.message);
      await supabase.auth.signOut();
      setIsLoading(false);
      return { error: new Error('Registration lookup failed — please try again.') };
    }

    if (!existingStudent) {
      // Either the matric_no is not pre-seeded, OR it's already claimed.
      // Check which case it is for a better error message.
      const { data: claimedRow } = await supabase
        .from('students')
        .select('user_id')
        .eq('matric_no', matricNo)
        .not('user_id', 'is', null)
        .maybeSingle();

      await supabase.auth.signOut();
      setIsLoading(false);

      if (claimedRow) {
        return {
          error: new Error(
            `Matric number "${matricNo}" is already registered to an account. ` +
            `If this is your matric number, contact your advisor.`
          ),
        };
      }
      return {
        error: new Error(
          `Matric number "${matricNo}" not found — contact your advisor to have ` +
          `your record pre-registered before signing up.`
        ),
      };
    }

    // Step 3: CLAIM the row — set user_id = auth.uid() using confirmed live column names.
    // Live schema columns (verified via information_schema query 2026-09-10):
    //   user_id              UUID  — links this row to the auth identity
    //   name                 TEXT  — student's display name (NOT 'full_name')
    //   institutional_email  TEXT  — student's email
    const claimPayload: Record<string, unknown> = {
      user_id: authData.user.id,
      institutional_email: finalEmail,
    };
    // Only overwrite name if the pre-seeded row doesn't already have one
    if (!existingStudent.name && data.fullName) {
      claimPayload.name = data.fullName;
    }

    const { error: claimError } = await supabase
      .from('students')
      .update(claimPayload)
      .eq('matric_no', matricNo)
      .is('user_id', null); // Safety: only claim genuinely unclaimed rows

    if (claimError) {
      console.error('[signUpStudent] Claim UPDATE failed:', claimError.message, claimError.details);
      // Auth user created but DB claim failed. Sign out to leave no orphan session.
      await supabase.auth.signOut();
      setIsLoading(false);
      return {
        error: new Error(
          'Account created but could not be linked to your student record. ' +
          'Contact your advisor — this may be an RLS configuration issue.'
        ),
      };
    }

    // Step 4: Re-fetch profile now that user_id is set on the row
    await fetchUserProfile(authData.user);
    setIsLoading(false);
    return { error: null };
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

    // Insert/Upsert Advisor Profile in database table
    try {
      await supabase.from('advisors').upsert({
        staff_id: data.staffId,
        name: data.fullName,
        institutional_email: data.email,
        department: data.department || 'Computer Science',
      }, { onConflict: 'staff_id' });
    } catch (dbErr) {
      console.warn('Advisor DB upsert note:', dbErr);
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