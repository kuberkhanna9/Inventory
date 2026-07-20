'use client';

import { useState, useTransition } from 'react';
import { approveAllPendingAction } from '@/app/actions';
import { AlertTriangle, CheckCircle, CheckSquare, Loader2 } from 'lucide-react';

interface DashboardApproveAllProps {
  pendingCount: number;
  isSuperAdmin: boolean;
}

export default function DashboardApproveAll({ pendingCount, isSuperAdmin }: DashboardApproveAllProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleApproveAll = () => {
    if (pendingCount === 0) return;
    setShowConfirm(true);
  };

  const confirmApproveAll = () => {
    setShowConfirm(false);
    setFeedback(null);
    startTransition(async () => {
      const result = await approveAllPendingAction();
      if (result.success) {
        setFeedback({ type: 'success', message: result.message || 'All requests reviewed!' });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({ type: 'error', message: result.error || 'Operation failed.' });
        setTimeout(() => setFeedback(null), 5000);
      }
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Stock Requests</span>
        <span className={`text-2xl font-black mt-2 block ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
          {pendingCount}
        </span>
      </div>

      {isSuperAdmin && pendingCount > 0 && (
        <div className="mt-4">
          <button
            onClick={handleApproveAll}
            disabled={isPending}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs py-2 px-3 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckSquare size={12} />
                <span>Approve All</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 text-slate-800 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckSquare size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Approve all pending stock requests?</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  Approve all {pendingCount} requests instantly
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
              Are you sure you want to approve every pending stock request? Requests violating warehouse inventory balance constraints will be skipped automatically.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproveAll}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                Approve All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Feedback */}
      {feedback && (
        <div className={`absolute bottom-0 inset-x-0 p-2 text-center text-[9px] font-black uppercase tracking-wider animate-in fade-in duration-300 ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}
