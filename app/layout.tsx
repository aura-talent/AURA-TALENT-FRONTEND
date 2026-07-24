import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono, Spline_Sans_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";
import { RouteGuard } from "@/components/RouteGuard";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// the blueprint voice of the hero diorama
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aura Talent — Know which jobs deserve you",
  description:
    "Aura reads a job post the way a sharp recruiter would: scores your real fit, shows what to fix in your resume, and tells you when to walk away.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aura Talent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Aura Talent",
    title: "Aura Talent — Know which jobs deserve you",
    description: "AI-powered career intelligence. Score your fit, fix your resume, and find the jobs that deserve you.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e1c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* PWA meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Aura Talent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Aura Talent" />
        <meta name="msapplication-TileColor" content="#0b0e1c" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable} ${spaceMono.variable}`}>
        <AuthProvider>
          <RouteGuard>
            <Nav />
            <main>{children}</main>
            <PWAInstallPrompt />
            <footer className="footer">
              <div className="footer-inner">
                <span>© {new Date().getFullYear()} Aura Talent</span>
                <span>
                  Powered by{" "}
                  <a
                    href="https://github.com/santifer/career-ops"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    career-ops
                  </a>
                  , open source
                </span>
              </div>
            </footer>
          </RouteGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
