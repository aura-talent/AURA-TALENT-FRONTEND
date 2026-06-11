"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { api, setUserId } from "@/lib/api";
import { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithLinkedIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (newRole: string, redirectTo?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
        let activeRole = "candidate";
        try {
          // Query the custom users table directly via Supabase client
          // (avoids backend routing issues and uses the user's own JWT for RLS)
          const { data: userRow } = await supabase
            .from("users")
            .select("role")
            .eq("id", authId)
            .single();
          if (userRow?.role) {
            activeRole = userRow.role;
          } else {
            // User not in custom table yet — check pending role from onboarding
            const pendingRole = localStorage.getItem("aura_pending_role");
            activeRole = pendingRole ?? userMeta?.role ?? "candidate";
            if (pendingRole) localStorage.removeItem("aura_pending_role");
          }
        } catch {
          const pendingRole = localStorage.getItem("aura_pending_role");
          activeRole = pendingRole ?? userMeta?.role ?? "candidate";
          if (pendingRole) localStorage.removeItem("aura_pending_role");
        }
        setRole(activeRole);

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
      setRole(null);
    }
    setLoading(false);
  }

  const updateRole = async (newRole: string, redirectTo?: string) => {
    if (!user) return;
    try {
      // Write role directly to the custom users table via Supabase
      await supabase.from("users").upsert({
        id: user.id,
        email: user.email ?? null,
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        role: newRole,
      });
      setRole(newRole);
      if (redirectTo) router.push(redirectTo);
    } catch (err) {
      console.error("Failed to update user role:", err);
    }
  };

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
        role,
        loading,
        signInWithGoogle,
        signInWithLinkedIn,
        signOut,
        updateRole,
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
