'use client';

import { useState, useTransition } from 'react';
import { ApprovalPolicy } from '@/utils/types';
import { updateApprovalPolicyAction } from '@/app/actions';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Lock,
  AlertTriangle,
  CheckCircle,
  Settings2,
  Gauge,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ApprovalPoliciesProps {
  policies: ApprovalPolicy[];
  isSuperAdmin: boolean;
}

export default function ApprovalPolicies({ policies, isSuperAdmin }: ApprovalPoliciesProps) {
  const [localPolicies, setLocalPolicies] = useState<ApprovalPolicy[]>(policies);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);
  const [confirmOverride, setConfirmOverride] = useState<{ policyId: string; nextMode: 'AUTO' | 'THRESHOLD' } | null>(null);
  const [isPending, startTransition] = useTransition();

  // High risk keys:
  const HIGH_RISK_KEYS = [
    'DELETE_SKU',
    'OPENING_STOCK',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'DAMAGE_NON_REPAIRABLE',
    'MANUAL_CORRECTION'
  ];

  const handleModeChange = (policyId: string, nextMode: 'AUTO' | 'MANUAL' | 'THRESHOLD') => {
    const policy = localPolicies.find(p => p.id === policyId);
    if (!policy) return;

    const isHighRisk = HIGH_RISK_KEYS.includes(policy.transactionKey);

    // If changing high risk type to AUTO or THRESHOLD, require confirmation
    if (isHighRisk && nextMode !== 'MANUAL' && policy.approvalMode === 'MANUAL') {
      setConfirmOverride({ policyId, nextMode });
      return;
    }

    updatePolicy(policyId, {
      approvalMode: nextMode,
      thresholdQuantity: nextMode === 'THRESHOLD' ? (policy.thresholdQuantity || 100) : 0
    });
  };

  const confirmHighRiskOverride = () => {
    if (!confirmOverride) return;
    const policy = localPolicies.find(p => p.id === confirmOverride.policyId);
    if (!policy) return;

    updatePolicy(confirmOverride.policyId, {
      approvalMode: confirmOverride.nextMode,
      thresholdQuantity: confirmOverride.nextMode === 'THRESHOLD' ? (policy.thresholdQuantity || 100) : 0
    });
    setConfirmOverride(null);
  };

  const handleThresholdChange = (policyId: string, value: number) => {
    setLocalPolicies(prev =>
      prev.map(p => p.id === policyId ? { ...p, thresholdQuantity: value } : p)
    );
  };

  const handleThresholdBlur = (policyId: string) => {
    const policy = localPolicies.find(p => p.id === policyId);
    if (!policy) return;

    updatePolicy(policyId, {
      approvalMode: policy.approvalMode,
      thresholdQuantity: policy.thresholdQuantity
    });
  };

  const updatePolicy = (policyId: string, data: { approvalMode: 'AUTO' | 'MANUAL' | 'THRESHOLD'; thresholdQuantity: number }) => {
    setSavingId(policyId);
    setFeedback(null);

    // Optimistic update
    setLocalPolicies(prev =>
      prev.map(p => p.id === policyId ? { ...p, ...data } : p)
    );

    startTransition(async () => {
      const result = await updateApprovalPolicyAction(policyId, data);
      setSavingId(null);

      if (result.success) {
        setFeedback({ id: policyId, type: 'success', message: 'Saved successfully' });
        setTimeout(() => setFeedback(null), 2500);
      } else {
        setFeedback({ id: policyId, type: 'error', message: result.error || 'Failed to save' });
        // Revert optimistic update
        setLocalPolicies(policies);
      }
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="border border-slate-200 bg-slate-50 p-8 rounded-2xl text-center space-y-4 shadow-inner">
        <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-sm">
          <Lock size={24} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-700">Access Restricted</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
            Only SuperAdmin accounts can configure approval workflow policies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200/80 rounded-2xl">
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
          <Settings2 size={16} className="text-slate-600" />
        </div>
        <div>
          <h3 className="text-xs font-extrabold text-slate-800">Dynamic Approval Policies</h3>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            Configure transaction-specific approval routing. Choose between instant auto-approval, manual authorization, or quantity-bound threshold approval.
          </p>
        </div>
      </div>

      {/* Policy list */}
      <div className="space-y-3">
        {localPolicies.map((policy) => {
          const isHighRisk = HIGH_RISK_KEYS.includes(policy.transactionKey);
          const isSaving = savingId === policy.id;
          const policyFeedback = feedback?.id === policy.id ? feedback : null;

          return (
            <div
              key={policy.id}
              className={`p-4 rounded-2xl border transition-all duration-200 bg-white border-slate-200 hover:border-slate-300 ${
                policy.approvalMode === 'AUTO' ? 'ring-1 ring-emerald-100 bg-emerald-50/10' :
                policy.approvalMode === 'THRESHOLD' ? 'ring-1 ring-blue-100 bg-blue-50/10' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Policy Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    policy.approvalMode === 'AUTO' ? 'bg-emerald-100 text-emerald-600' :
                    policy.approvalMode === 'THRESHOLD' ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {policy.approvalMode === 'AUTO' ? <Zap size={14} /> :
                     policy.approvalMode === 'THRESHOLD' ? <Gauge size={14} /> :
                     <ShieldCheck size={14} />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-800 truncate">{policy.displayName}</span>
                      {isHighRisk && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                          <AlertTriangle size={8} />
                          High Risk
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{policy.transactionKey}</span>
                  </div>
                </div>

                {/* Mode Selector and Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Threshold Quantity Input */}
                  {policy.approvalMode === 'THRESHOLD' && (
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                      <span className="text-[9px] font-bold text-slate-400">Qty ≤</span>
                      <input
                        type="number"
                        min="1"
                        value={policy.thresholdQuantity || ''}
                        onChange={(e) => handleThresholdChange(policy.id, Number(e.target.value))}
                        onBlur={() => handleThresholdBlur(policy.id)}
                        className="w-14 bg-white border border-slate-200 rounded-lg py-0.5 text-[10px] font-bold text-slate-700 text-center focus:outline-none focus:border-blue-400"
                        placeholder="Limit"
                      />
                      <span className="text-[9px] font-bold text-slate-400">pcs</span>
                    </div>
                  )}

                  {/* Dropdown Selector */}
                  <select
                    value={policy.approvalMode}
                    onChange={(e) => handleModeChange(policy.id, e.target.value as any)}
                    disabled={isSaving}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer"
                  >
                    <option value="MANUAL">MANUAL APPROVAL</option>
                    <option value="AUTO">AUTO APPROVE</option>
                    <option value="THRESHOLD">THRESHOLD AUTO</option>
                  </select>

                  {/* Feedback / Spinner */}
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin shrink-0" />
                  )}
                  {policyFeedback && (
                    <span className={`text-[9px] font-bold shrink-0 ${
                      policyFeedback.type === 'success' ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                      {policyFeedback.type === 'success' ? <CheckCircle size={10} className="inline mr-0.5" /> : null}
                      {policyFeedback.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmOverride && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                <ShieldAlert size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Override High-Risk Transaction?</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {localPolicies.find(p => p.id === confirmOverride.policyId)?.displayName}
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
              This transaction type is categorized as high-risk. Changing it from manual approval bypasses standard SuperAdmin auditing workflows.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOverride(null)}
                className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmHighRiskOverride}
                className="flex-1 bg-amber-500 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-amber-600 cursor-pointer transition-colors shadow-sm"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
