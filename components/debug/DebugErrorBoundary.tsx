"use client";

import React from "react";

interface DebugErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface DebugErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Error boundary specifically for the debug panel.
 * If the debug panel crashes, this prevents it from taking down the entire app.
 */
export class DebugErrorBoundary extends React.Component<
  DebugErrorBoundaryProps,
  DebugErrorBoundaryState
> {
  constructor(props: DebugErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): DebugErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[DebugPanel] Error caught by boundary:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="fixed right-0 top-0 h-full w-[480px] z-50
                     bg-black/90 backdrop-blur-md border-l border-red-500/30
                     flex flex-col items-center justify-center p-8 font-mono"
        >
          <div className="text-red-400 text-lg font-bold mb-4">
            [DEBUG PANEL ERROR]
          </div>
          <div className="text-gray-400 text-sm text-center mb-4">
            The debug panel encountered an error and has been disabled.
          </div>
          <div className="text-red-300 text-xs bg-red-500/10 p-3 rounded mb-4 max-w-full overflow-auto">
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded
                       text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
