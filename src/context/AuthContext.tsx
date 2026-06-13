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

  useEffect(() => {
    let mounted = true;

    // 🧠 1. The Resolver: It takes whatever session it is handed and finds the role.
    const resolveProfile = async (currentSession: any) => {
      if (!currentSession) {
        if (mounted) {
          setUser(null);
          setRole(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        if (mounted) setUser(currentSession.user);
        const email = currentSession.user.email;

        // ✨ Check Students
        const { data: student } = await db.from('students').select('*').eq('institutional_email', email).maybeSingle();
        if (student) {
          if (mounted) { setRole('student'); setProfile(student); }
          return;
        }

        // ✨ Check Advisors
        const { data: advisor } = await db.from('advisors').select('*').eq('institutional_email', email).maybeSingle();
        if (advisor) {
          if (mounted) { setRole('advisor'); setProfile(advisor); }
          return;
        }

        // ✨ Check Admins
        const { data: admin } = await db.from('admins').select('*').eq('institutional_email', email).maybeSingle();
        if (admin) {
          if (mounted) { setRole('admin'); setProfile(admin); }
          return;
        }

        // 🚫 Not found in any table
        if (mounted) { setRole(null); setProfile(null); }

      } catch (err) {
        console.error("Auth Context Resolution Error:", err);
      } finally {
        // 🛡️ Always unlock the loading screen no matter what happens
        if (mounted) setLoading(false);
      }
    };

    // 🚀 2. Initial Mount Fetch
    db.auth.getSession().then(({ data: { session } }) => {
      resolveProfile(session);
    });

    // 📡 3. Cross-Tab & Event Listener (Never calls getSession manually!)
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        if (event === 'SIGNED_OUT') {
          setLoading(true);
          resolveProfile(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setLoading(true);
          resolveProfile(session); // Pass the session directly, no manual fetching!
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