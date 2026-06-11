import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";
import { RouteGuard } from "@/components/RouteGuard";
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

export const metadata: Metadata = {
  title: "Aura Talent — Know which jobs deserve you",
  description:
    "Aura reads a job post the way a sharp recruiter would: scores your real fit, shows what to fix in your resume, and tells you when to walk away.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <AuthProvider>
          <RouteGuard>
            <Nav />
            <main>{children}</main>
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
