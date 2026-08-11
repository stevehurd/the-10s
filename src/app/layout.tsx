import type { Metadata } from "next";
import Script from "next/script";

import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "The 10s",
  description: "Administrative dashboard for managing your football pool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <ThemeToggle />
        <Script id="theme-preference" strategy="beforeInteractive">
          {`try{var stored=localStorage.getItem('football-pool-theme');var theme=stored==='light'||stored==='dark'?stored:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=theme}catch(e){document.documentElement.dataset.theme='dark'}`}
        </Script>
      </body>
    </html>
  );
}
