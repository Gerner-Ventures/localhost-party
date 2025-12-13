import { WebSocketProvider } from '@/lib/context/WebSocketContext';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'localhost:party - Controller',
  description: 'Party games powered by AI',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ControllerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <div className="min-h-screen bg-gradient-to-b from-indigo-600 via-purple-600 to-purple-700 touch-manipulation">
        {children}
      </div>
    </WebSocketProvider>
  );
}
