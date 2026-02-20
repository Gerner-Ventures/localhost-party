import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AudioProvider } from "@/lib/context/AudioContext";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VercelToolbar } from "@vercel/toolbar/next";
import PostHogAnalytics from "./posthog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "localhost:party",
  description: "AI-powered party games inspired by Jackbox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldShowToolbar = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AudioProvider>{children}</AudioProvider>
        <PostHogAnalytics />
        <Analytics />
        <SpeedInsights />
        {shouldShowToolbar && <VercelToolbar />}
      </body>
    </html>
  );
}
