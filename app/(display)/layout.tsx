import { WebSocketProvider } from "@/lib/context/WebSocketContext";
import { AudioProvider } from "@/lib/context/AudioContext";
import { AgentProvider } from "@/lib/context/AgentContext";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "localhost:party - Display",
  description: "Party games powered by AI",
};

export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioProvider>
      <WebSocketProvider>
        <AgentProvider>
          <div
            className="fixed inset-0 overflow-hidden"
            style={{ background: "var(--noir-black)" }}
          >
            {/* Animated gradient background */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `
              radial-gradient(ellipse at 20% 20%, rgba(0, 245, 255, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 80%, rgba(255, 0, 170, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(240, 255, 0, 0.05) 0%, transparent 70%)
            `,
              }}
            />

            {/* Grid pattern overlay */}
            <div className="absolute inset-0 grid-pattern opacity-50" />

            {/* Scanlines effect */}
            <div className="absolute inset-0 scanlines" />

            {/* CRT vignette */}
            <div className="absolute inset-0 crt-curve" />

            {/* Content */}
            <div className="relative z-10 h-full">{children}</div>

            {/* Decorative corner elements */}
            <div
              className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 opacity-30"
              style={{ borderColor: "var(--neon-cyan)" }}
            />
            <div
              className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 opacity-30"
              style={{ borderColor: "var(--neon-cyan)" }}
            />
            <div
              className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 opacity-30"
              style={{ borderColor: "var(--neon-magenta)" }}
            />
            <div
              className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 opacity-30"
              style={{ borderColor: "var(--neon-magenta)" }}
            />
          </div>
        </AgentProvider>
      </WebSocketProvider>
    </AudioProvider>
  );
}
