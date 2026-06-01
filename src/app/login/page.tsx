'use client';

import { useActionState, useEffect } from 'react';
import { loginAction } from '@/app/actions';
import { Lock, User, AlertCircle } from 'lucide-react';

const initialFormState = {
  success: false,
  error: '',
  message: ''
};

export default function LoginPage() {
  const [formState, formAction, isPending] = useActionState(loginAction, initialFormState);

  useEffect(() => {
    if (formState.success) {
      // Force instant hard reload on successful login to synchronize session layout trees
      window.location.href = '/';
    }
  }, [formState.success]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
      <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        
        {/* Centered Large Company Logo */}
        <div className="text-center">
          <img 
            src="/logo.png" 
            alt="Lall Ji Knitwears Logo" 
            className="h-20 sm:h-24 object-contain mx-auto select-none pointer-events-none" 
          />
        </div>

        <form action={formAction} className="space-y-5">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><User size={14} /></span>
              <input
                type="text"
                name="username"
                required
                autoFocus
                placeholder="Enter factory account name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-700 focus:outline-none focus:border-slate-800 focus:bg-white transition-all font-semibold"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={14} /></span>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-700 focus:outline-none focus:border-slate-800 focus:bg-white transition-all font-semibold"
              />
            </div>
          </div>

          {/* Error Banner */}
          {formState.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-semibold flex items-start gap-2 animate-shake">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{formState.error}</span>
            </div>
          )}

          {/* Success Banner */}
          {formState.success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3 text-xs font-semibold">
              {formState.message || 'Authenticated successfully! Redirecting...'}
            </div>
          )}

          {/* Login Action Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50 transition-all select-none shadow-sm flex items-center justify-center gap-1.5"
          >
            {isPending ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
