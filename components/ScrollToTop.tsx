"use client";

/**
 * Start every navigation at the top of the page.
 *
 * The App Router's own scroll handling doesn't survive this app's layout:
 * `EmployerShell` and the candidate shell stay mounted across navigation and
 * only swap `{children}`, so a route change often leaves the window parked at
 * whatever offset the previous page was scrolled to. The new page then opens
 * mid-way down and has to be scrolled up by hand.
 *
 * Two cases are deliberately left alone:
 *
 *   - Back/forward, where the browser's own scroll restoration is the correct
 *     behaviour — returning to a long list should land where you left it. A
 *     `popstate` listener flags those so the effect below skips them.
 *   - Anchored URLs (`/page#section`), where the fragment is the request.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();
  const poppedRef = useRef(false);

  useEffect(() => {
    function onPopState() {
      poppedRef.current = true;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // popstate fires before React commits the new pathname, so the flag is
    // already set by the time this runs for a back/forward navigation.
    if (poppedRef.current) {
      poppedRef.current = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
