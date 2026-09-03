import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AdvisorProfile {
  id: string;
  university_id: string;
  staff_id: string;
  full_name: string;
  email: string;
  department?: string;
  tier: 'freemium' | 'pro' | 'department' | 'enterprise';
  monthly_audit_count: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  advisor: AdvisorProfile | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpAdvisor: (data: {
    email: string;
    password: string;
    fullName: string;
    staffId: string;
    universityId: string;
    department?: string;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAdvisorProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAdvisorProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('advisors')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Advisor profile not found or RLS restricted:', error.message);
        setAdvisor(null);
      } else {
        setAdvisor(data as AdvisorProfile);
      }
    } catch (err) {
      console.error('Error fetching advisor profile:', err);
      setAdvisor(null);
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAdvisorProfile(session.user.id).finally(() => setIsLoading(false));
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
          await fetchAdvisorProfile(session.user.id);
        } else {
          setAdvisor(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    return { error };
  };

  const signUpAdvisor = async (data: {
    email: string;
    password: string;
    fullName: string;
    staffId: string;
    universityId: string;
    department?: string;
  }) => {
    setIsLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user) {
      setIsLoading(false);
      return { error: authError };
    }

    // Insert Advisor Profile
    const { error: profileError } = await supabase.from('advisors').insert({
      id: authData.user.id,
      university_id: data.universityId,
      staff_id: data.staffId,
      full_name: data.fullName,
      email: data.email,
      department: data.department || 'Computer Science',
      tier: 'freemium',
      monthly_audit_count: 0,
    });

    if (profileError) {
      console.error('Failed to create advisor profile:', profileError);
      setIsLoading(false);
      return { error: profileError };
    }

    await fetchAdvisorProfile(authData.user.id);
    setIsLoading(false);
    return { error: null };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAdvisor(null);
    setIsLoading(false);
  };

  const refreshAdvisorProfile = async () => {
    if (user) {
      await fetchAdvisorProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        advisor,
        isLoading,
        signInWithEmail,
        signUpAdvisor,
        signOut,
        refreshAdvisorProfile,
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