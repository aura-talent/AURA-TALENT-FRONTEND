"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Helper function to trigger PWA install modal from anywhere in the app */
export function openPWAInstall() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("aura_pwa_dismissed");
    window.dispatchEvent(new CustomEvent("aura-open-pwa-install"));
  }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (PWA installed and opened)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Listen for custom trigger event (e.g. user clicked "Install App" in menu)
    const handleCustomOpen = () => {
      if (ios) {
        setShowIOSGuide(true);
      } else if (deferredPrompt) {
        deferredPrompt.prompt();
      } else {
        setShowAndroidGuide(true);
      }
    };
    window.addEventListener("aura-open-pwa-install", handleCustomOpen);

    // Check if user dismissed prompt recently
    const dismissed = localStorage.getItem("aura_pwa_dismissed");
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 86400000 * 3) {
      return () => {
        window.removeEventListener("aura-open-pwa-install", handleCustomOpen);
      };
    }

    if (ios && !isStandalone) {
      const t = setTimeout(() => setShowPrompt(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("aura-open-pwa-install", handleCustomOpen);
      };
    }

    // Listen for Chrome/Android/Edge beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const fallbackTimer = setTimeout(() => {
      if (!isStandalone) {
        setShowPrompt(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("aura-open-pwa-install", handleCustomOpen);
      clearTimeout(fallbackTimer);
    };
  }, [isStandalone, deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowAndroidGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    setShowAndroidGuide(false);
    localStorage.setItem("aura_pwa_dismissed", Date.now().toString());
  };

  if (isStandalone || (!showPrompt && !showIOSGuide && !showAndroidGuide)) {
    return null;
  }

  return (
    <>
      {/* PWA Floating Install Banner */}
      {showPrompt && !showIOSGuide && !showAndroidGuide && (
        <div
          role="banner"
          aria-label="Install Aura Talent app"
          style={{
            position: "fixed",
            bottom: "max(20px, env(safe-area-inset-bottom, 20px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99,
            width: "min(440px, calc(100vw - 32px))",
            background: "linear-gradient(135deg, rgba(18, 22, 51, 0.95), rgba(11, 14, 28, 0.98))",
            border: "1px solid rgba(199, 185, 255, 0.35)",
            borderRadius: "18px",
            padding: "14px 18px",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.65), 0 0 20px rgba(143,125,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            animation: "pwa-banner-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <style>{`
            @keyframes pwa-banner-slide-up {
              from { transform: translate(-50%, 100%); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>

          {/* App Icon */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              flexShrink: 0,
              background: "linear-gradient(135deg, #c7b9ff, #8f7dff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(143,125,255,0.4)",
            }}
          >
            <span style={{ fontSize: 20 }}>📲</span>
          </div>

          {/* Text Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fafaf8", lineHeight: 1.2 }}>
              Install Aura App
            </div>
            <div style={{ fontSize: "0.76rem", color: "rgba(250,250,248,0.6)", marginTop: 2 }}>
              Add to Home Screen for fast 1-tap access
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleInstallClick}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #c7b9ff, #8f7dff)",
                border: "none",
                color: "#0b0e1c",
                fontWeight: 800,
                fontSize: "0.82rem",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(143,125,255,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              Install
            </button>

            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(250,250,248,0.45)",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Android / Desktop Step-by-Step Guide Modal */}
      {showAndroidGuide && (
        <div
          onClick={handleDismiss}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(7,9,20,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 16px 24px",
            animation: "pwa-fade 0.25s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(400px, 100%)",
              background: "#121633",
              border: "1px solid rgba(199, 185, 255, 0.3)",
              borderRadius: 20,
              padding: "22px 20px",
              color: "#fafaf8",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Install Aura App</div>
              <button
                onClick={handleDismiss}
                style={{ background: "none", border: "none", color: "rgba(250,250,248,0.5)", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.88rem", color: "rgba(250,250,248,0.8)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(199,185,255,0.15)", color: "#c7b9ff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>1</span>
                <span>Tap Chrome/Edge menu (<strong>⋮</strong>) in top-right</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(199,185,255,0.15)", color: "#c7b9ff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>2</span>
                <span>Select <strong>Add to Home screen</strong> or <strong>Install app</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(199,185,255,0.15)", color: "#c7b9ff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>3</span>
                <span>Tap <strong>Install</strong> to add Aura to your home screen</span>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "12px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #c7b9ff, #8f7dff)",
                border: "none",
                color: "#0b0e1c",
                fontWeight: 800,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* iOS Step-by-Step Guide Modal */}
      {showIOSGuide && (
        <div
          onClick={handleDismiss}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(7,9,20,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 16px 24px",
            animation: "pwa-fade 0.25s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(400px, 100%)",
              background: "#121633",
              border: "1px solid rgba(199, 185, 255, 0.3)",
              borderRadius: 20,
              padding: "22px 20px",
              color: "#fafaf8",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Install on iOS Safari</div>
              <button
                onClick={handleDismiss}
                style={{ background: "none", border: "none", color: "rgba(250,250,248,0.5)", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.88rem", color: "rgba(250,250,248,0.8)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(199,185,255,0.15)", color: "#c7b9ff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>1</span>
                <span>Tap the <strong>Share button</strong> ⎋ at the bottom of Safari</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(199,185,255,0.15)", color: "#c7b9ff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>2</span>
                <span>Scroll down and select <strong>Add to Home Screen</strong> ➕</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(199,185,255,0.15)", color: "#c7b9ff", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>3</span>
                <span>Tap <strong>Add</strong> in the top-right corner</span>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "12px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #c7b9ff, #8f7dff)",
                border: "none",
                color: "#0b0e1c",
                fontWeight: 800,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
