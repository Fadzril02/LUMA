import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
      <span className="text-xs font-mono tracking-widest text-slate-400">
        INITIALIZING L.U.M.A. SECURE CONTEXT...
      </span>
    </div>
  );
}

export default LoadingScreen;
