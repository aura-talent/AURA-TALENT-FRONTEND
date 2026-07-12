"use client";

import { useAuth } from "./AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const PUBLIC_ROUTES = ["/", "/login", "/auth/callback"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isEmployerRoute = pathname.startsWith("/employer");
  const isCandidateRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/evaluate") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/compare") ||
    pathname.startsWith("/report") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/onboarding");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (isEmployerRoute || isCandidateRoute) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    if (role === "employer") {
      if (isCandidateRoute) {
        router.push("/employer");
      }
    } else if (role === "candidate" || role === null) {
      if (isEmployerRoute) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, role, pathname, router, isEmployerRoute, isCandidateRoute]);

  if (loading) {
    if (isEmployerRoute || isCandidateRoute) {
      return (
        <div className="container" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
          <div className="thinking">
            <div className="thinking-orb" />
            <p className="thinking-status">Checking access permissions…</p>
          </div>
        </div>
      );
    }
  }

  if (user) {
    if (role === "employer" && isCandidateRoute) {
      return null;
    }
    if ((role === "candidate" || role === null) && isEmployerRoute) {
      return null;
    }
  } else {
    if (isEmployerRoute || isCandidateRoute) {
      return null;
    }
  }

  return <>{children}</>;
}
