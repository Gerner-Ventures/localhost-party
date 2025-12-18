import { WebSocketProvider } from "@/lib/context/WebSocketContext";
import { AudioProvider } from "@/lib/context/AudioContext";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "localhost:party - Controller",
  description: "Party games powered by AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ControllerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioProvider>
      <WebSocketProvider>
        <div
          className="min-h-screen touch-manipulation relative overflow-hidden"
          style={{ background: "var(--noir-black)" }}
        >
          {/* Subtle gradient glow */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `
              radial-gradient(ellipse at 50% 0%, rgba(0, 245, 255, 0.2) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 100%, rgba(255, 0, 170, 0.15) 0%, transparent 50%)
            `,
            }}
          />

          {/* Grid pattern - more subtle on mobile */}
          <div className="absolute inset-0 grid-pattern opacity-30" />

          {/* Content */}
          <div className="relative z-10 min-h-screen">{children}</div>

          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--neon-cyan), var(--neon-magenta), transparent)",
            }}
          />
        </div>
      </WebSocketProvider>
    </AudioProvider>
  );
}
