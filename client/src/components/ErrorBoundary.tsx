import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8f3e6] text-[#1d3b2e]">
          <div className="max-w-md w-full p-8 bg-[#fffdf6] border-2 border-[#e8dfc8] rounded-3xl shadow-xl text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#fde0e0] border-2 border-[#f4b6b6] flex items-center justify-center text-[#d63b3b]">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-[#1d3b2e] mb-2 font-['Baloo_2',sans-serif]">
              Terjadi Kesalahan Tampilan
            </h2>
            <p className="text-sm font-semibold text-[#5a6f62] mb-6">
              Halaman mengalami kendala saat memuat komponen antarmuka. Silakan muat ulang atau kembali ke dashboard.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-left text-xs font-mono text-red-700 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#f2c230] text-[#163a2b] font-black text-sm hover:brightness-105 cursor-pointer shadow-sm transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Muat Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/guru';
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white border-2 border-[#e8dfc8] text-[#163a2b] font-black text-sm hover:bg-[#f8f3e6] cursor-pointer shadow-sm transition-all"
              >
                <Home className="w-4 h-4" /> Ke Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

