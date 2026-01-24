import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        // In a real app, this would log to Google Cloud Logging
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 p-4 font-mono text-red-500">
                    <div className="flex max-w-md flex-col items-center space-y-6 text-center">
                        <ShieldAlert size={64} className="animate-pulse" />

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold tracking-widest uppercase">Critical Failure</h1>
                            <p className="text-sm opacity-80">
                                The terminal has encountered an unrecoverable exception.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="w-full overflow-hidden rounded border border-red-900/50 bg-red-950/20 p-4 text-left text-xs opacity-75">
                                <code className="break-all">{this.state.error.toString()}</code>
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="group flex items-center gap-2 rounded border border-red-800 bg-red-900/20 px-6 py-2 text-sm transition-all hover:bg-red-900/40 hover:text-red-400"
                        >
                            <RefreshCw size={14} className="group-hover:animate-spin" />
                            <span>REBOOT_SYSTEM</span>
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
