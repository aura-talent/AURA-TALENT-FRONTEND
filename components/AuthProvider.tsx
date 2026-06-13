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

      const userMeta = currentSession.user.user_metadata;
      try {
        let activeRole = "candidate";
        try {
          const authMode = localStorage.getItem("aura_auth_mode");
          const pendingRole = localStorage.getItem("aura_pending_role");

          // Fetch the user's existing DB row (may exist due to DB trigger even for new users)
          let userRowData: { role: string } | null = null;
          try {
            const { data: userRow } = await supabase
              .from("users")
              .select("role")
              .eq("id", authId)
              .single();
            userRowData = userRow;
          } catch {
            // Ignore — user may not have a row yet
          }

          if (authMode === "signup") {
            if (pendingRole) {
              // User explicitly chose a role — ALWAYS honor it.
              // Do not block based on DB row existence; the trigger may have already created one.
              activeRole = pendingRole;
              localStorage.removeItem("aura_pending_role");
              localStorage.removeItem("aura_auth_mode");
              await supabase.from("users").upsert({ id: authId, role: activeRole });
              // Fall through — /auth/callback will redirect based on role
            } else {
              // Signup flow reached without a role selection — send back to pick one.
              localStorage.removeItem("aura_auth_mode");
              await supabase.auth.signOut();
              if (typeof window !== "undefined") {
                window.location.href = `/login?mode=signup`;
              }
              return;
            }
          } else if (authMode === "signin") {
            // Returning user signing in
            if (userRowData?.role) {
              activeRole = userRowData.role;
              localStorage.removeItem("aura_auth_mode");
            } else {
              // No completed account found — redirect to sign up
              localStorage.removeItem("aura_auth_mode");
              await supabase.auth.signOut();
              if (typeof window !== "undefined") {
                window.location.href = `/login?mode=signup&error=account_not_found`;
              }
              return;
            }
          } else {
            // No auth mode — session restored (page refresh / direct navigation).
            // Just use whatever role is already in the DB.
            activeRole = userRowData?.role ?? userMeta?.role ?? "candidate";
          }
        } catch (innerErr) {
          console.error("Auth init error:", innerErr);
        }

        setRole(activeRole);

        await api.saveUser({
          id: authId,
          email: currentSession.user.email ?? null,
          full_name: userMeta?.full_name ?? userMeta?.name ?? null,
          avatar_url: userMeta?.avatar_url ?? userMeta?.picture ?? null,
          role: activeRole,
        });

        // Trigger data migration if we have a legacy anonymous ID
        const anonId = localStorage.getItem("aura_uid");
        if (anonId && anonId !== authId) {
          await api.migrateUser({
            anon_id: anonId,
            auth_id: authId,
          });
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
