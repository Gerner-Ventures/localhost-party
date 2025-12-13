import { WebSocketProvider } from '@/lib/context/WebSocketContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'localhost:party - Display',
  description: 'Party games powered by AI',
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden">
        {children}
      </div>
    </WebSocketProvider>
  );
}
