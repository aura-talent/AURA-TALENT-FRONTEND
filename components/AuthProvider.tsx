"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { api, setUserId } from "@/lib/api";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithLinkedIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSessionChange(initialSession);
    });

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      await handleSessionChange(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSessionChange(currentSession: Session | null) {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (currentSession?.user) {
      const authId = currentSession.user.id;
      setUserId(authId);

      // Save/sync user info to backend
      const userMeta = currentSession.user.user_metadata;
      try {
        await api.saveUser({
          id: authId,
          email: currentSession.user.email ?? null,
          full_name: userMeta?.full_name ?? userMeta?.name ?? null,
          avatar_url: userMeta?.avatar_url ?? userMeta?.picture ?? null,
        });

        // Trigger data migration if we have a legacy anonymous ID
        const anonId = localStorage.getItem("aura_uid");
        if (anonId && anonId !== authId) {
          await api.migrateUser({
            anon_id: anonId,
            auth_id: authId,
          });
          // Update aura_uid in localStorage to user ID to prevent redundant migrations
          localStorage.setItem("aura_uid", authId);
        }
      } catch (err) {
        console.error("Failed to sync auth user to backend:", err);
      }
    } else {
      setUserId(null); // Fallback to localStorage uuid
    }
    setLoading(false);
  }

  const signInWithGoogle = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  };

  const signInWithLinkedIn = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signInWithLinkedIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
