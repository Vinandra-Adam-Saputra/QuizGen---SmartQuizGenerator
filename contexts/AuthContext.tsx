import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../supabaseClient";
import type { Session, User, AuthError } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔁 Ambil session saat pertama kali load
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) console.error("Error fetching session:", error.message);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // 🧭 Listener untuk perubahan auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup listener
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ✅ Login (handle error)
  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.error("Login error:", error.message);
    return { error };
  };

  // ✅ Logout (fix 403 error + safe)
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut(); // cukup tanpa scope=global
      if (error) console.error("Logout error:", error.message);

      setUser(null);
      setSession(null);
      return { error };
    } catch (err: any) {
      console.error("Unexpected logout error:", err);
      return { error: err };
    }
  };

  const value = {
    user,
    session,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// ✅ Hook untuk akses context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
