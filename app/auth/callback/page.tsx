"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AuthCallback() {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Route based on the user's RBAC role stored in the backend
        if (role === "employer") {
          router.push("/employer");
        } else {
          // Candidates go to dashboard; if no role yet, default to candidate flow
          router.push("/dashboard");
        }
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, role, router]);

  return (
    <div
      className="container"
      style={{
        minHeight: "80vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div className="thinking">
        <div className="thinking-orb" />
        <p className="thinking-status">Signing in — setting up your workspace…</p>
      </div>
    </div>
  );
}
