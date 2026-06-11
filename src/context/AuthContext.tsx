import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { db } from '../lib/supabase';

type UserRole = 'student' | 'advisor' | 'admin' | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  profile: any | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const resolveUserRole = async (currentUser: User) => {
    try {
      const loginEmail = currentUser.email || "";
      const extractedInstitutionalId = loginEmail.split('@')[0].toUpperCase();

      if (!extractedInstitutionalId) {
        setRole(null);
        setProfile(null);
        return;
      }

      // 1. Check Student
      const { data: student } = await db.from('students').select('*, intakes(*), advisors(*)').eq('institutional_email', loginEmail).maybeSingle();
      if (student) {
        setRole('student');
        setProfile(student);
        return;
      }

      // 2. Check Advisor
      const { data: advisor } = await db.from('advisors').select('*').eq('staff_id', extractedInstitutionalId).maybeSingle();
      if (advisor) {
        setRole('advisor');
        setProfile(advisor);
        return;
      }

      // 3. Check Admin
      const { data: admin } = await db.from('admins').select('*').eq('staff_id', extractedInstitutionalId).maybeSingle();
      if (admin) {
        setRole('admin');
        setProfile(admin);
        return;
      }

      // No match
      setRole(null);
      setProfile(null);
    } catch (err) {
      console.error("System identity resolution fault:", err);
    } finally {
      // 🛡️ Always unlock the screen when done
      setLoading(false); 
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await db.auth.getSession();

        if (error) {
          console.error("Session verification failed.", error);
          if (mounted) {
            setUser(null);
            setRole(null);
            setProfile(null);
          }
        } else if (session && mounted) {
          setUser(session.user);
          const email = session.user.email;
          
          // ✨ 1. CHECK IF USER IS A STUDENT
          const { data: studentRecord } = await db
            .from('students')
            .select('*')
            .eq('institutional_email', email)
            .maybeSingle();

          if (studentRecord) {
            setRole('student');
            setProfile(studentRecord);
          } else {
            // ✨ 2. CHECK IF USER IS AN ADVISOR
            const { data: advisorRecord } = await db
              .from('advisors')
              .select('*')
              .eq('institutional_email', email)
              .maybeSingle();

            if (advisorRecord) {
              setRole('advisor');
              setProfile(advisorRecord);
            } 
            // ✨ 3. HARDCODED ADMIN FOR TESTING
            else if (email === 'admin@utm.my') {
              setRole('admin');
              setProfile({ name: 'System Administrator' });
            } 
            // 🚫 UNRECOGNIZED EMAIL
            else {
              setRole(null);
              setProfile(null);
            }
          }
        }
      } catch (err) {
        console.error("Critical Auth Fault:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // 2. Set up the real-time listener for login/logout clicks
    const { data: { subscription } } = db.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        if (event === 'SIGNED_OUT' || !session) {
          // Explicitly clear everything on logout
          setUser(null);
          setRole(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session.user);
          // Fetch role again if needed
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    await db.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be nested cleanly within an operational <AuthProvider /> wrapper stack.');
  }
  return context;
};