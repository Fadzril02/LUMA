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
        
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('matric_no', matricNo)
          .maybeSingle();

        if (error) {
          console.warn('Student record lookup warning:', error.message);
        }

        const fullName = data?.name || data?.full_name || currentUser.user_metadata?.full_name || matricNo;
        const advisorId = data?.advisor_staff_id || currentUser.user_metadata?.advisor_staff_id || 'STAFF-LIYANA';
        const curriculumYear = data?.curriculum_year || data?.syllabus_type || '2023/2024';
        const programCode = data?.program_code || data?.program || 'SECJ';

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

    // ── Priority 4: Claim-based registration ─────────────────────────────────
    // Step 1: Look up an EXISTING pre-seeded row by matric_no.
    // We use the service-role client is unavailable here (client-side), so we
    // read via anon key. RLS on students at this point allows SELECT on the
    // row only if user_id = auth.uid() — but we're not logged in yet.
    // The pre-flight check must be done BEFORE auth.signUp, using a
    // service-side RPC, or we accept the limitation that we create the auth
    // user first and then verify/claim. We create auth user first, then claim.
    // ─────────────────────────────────────────────────────────────────────────

    // Step 1: Create the Supabase Auth user
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
      return { error: authError };
    }

    // Step 2: Now that we're logged in, try to CLAIM the pre-seeded row.
    // Look up the existing students row by matric_no.
    const { data: existingStudent, error: lookupError } = await supabase
      .from('students')
      .select('matric_no, user_id')
      .eq('matric_no', matricNo)
      .maybeSingle();

    if (lookupError) {
      // Rollback: delete the auth user we just created
      console.error('Student lookup failed:', lookupError);
      await supabase.auth.signOut();
      setIsLoading(false);
      return { error: new Error('Registration lookup failed. Please try again.') };
    }

    if (!existingStudent) {
      // Matric number not pre-seeded by advisor — reject
      await supabase.auth.signOut();
      setIsLoading(false);
      return {
        error: new Error(
          `Matric number "${matricNo}" not found in the system. ` +
          `Please contact your advisor to have your record pre-registered before signing up.`
        )
      };
    }

    if (existingStudent.user_id && existingStudent.user_id !== authData.user.id) {
      // Already claimed by a different auth user — reject
      await supabase.auth.signOut();
      setIsLoading(false);
      return {
        error: new Error(
          `Matric number "${matricNo}" is already registered to an account. ` +
          `If this is your matric number, contact your advisor.`
        )
      };
    }

    // Step 3: Claim the row by setting user_id = auth.uid()
    const { error: claimError } = await supabase
      .from('students')
      .update({
        user_id: authData.user.id,
        institutional_email: finalEmail,
        name: existingStudent.user_id ? undefined : data.fullName, // don't overwrite if already set
      })
      .eq('matric_no', matricNo);

    if (claimError) {
      console.error('Student claim failed:', claimError);
      // Don't sign out — auth user exists, just log the DB issue
      console.warn('user_id claim failed — student row exists but could not be linked. This may be an RLS issue.');
    }

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