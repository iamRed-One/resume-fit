import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { THEME_SCRIPT } from "./theme-picker";

export const metadata: Metadata = {
  title: "Resume Fit",
  description: "Match your resume to a job posting, tailor it honestly, and see what changed and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme attribute is set by a tiny script before first paint, so the server HTML and the client differ on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
