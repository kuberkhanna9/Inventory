'use client';

import { useActionState } from 'react';
import { recordTransactionAction } from '@/app/actions';
import { Lock, PlusCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { ProductVariant } from '@/utils/types';

interface TransactionFormProps {
  userRole: 'ADMIN' | 'STAFF';
  variants: ProductVariant[];
}

const initialState = {
  success: false,
  error: '',
  message: ''
};

export default function TransactionForm({ userRole, variants }: TransactionFormProps) {
  const [state, formAction, isPending] = useActionState(recordTransactionAction, initialState);

  if (userRole === 'STAFF') {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-6 rounded-2xl text-center space-y-4 shadow-inner">
        <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500 shadow-md">
          <Lock size={20} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-neutral-300">Staff Read-Only Mode</h4>
          <p className="text-xs text-neutral-500 mt-1 max-w-[220px] mx-auto leading-relaxed">
            Your account role is restricted from writing to the ledger. Switching to **Admin Mode** in the sidebar toggles authorization.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/20">
          <ShieldAlert size={12} />
          <span>DB level RLS Active</span>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* SKU Select Dropdown */}
      <div>
        <label htmlFor="variantId" className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
          Knitwear SKU
        </label>
        <select
          id="variantId"
          name="variantId"
          required
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="">Select SKU...</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.sku} ({v.color} - {v.size})
            </option>
          ))}
        </select>
      </div>

      {/* Transaction Type Select */}
      <div>
        <label htmlFor="transactionType" className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
          Movement Type
        </label>
        <select
          id="transactionType"
          name="transactionType"
          required
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="STOCK_IN">STOCK IN (Production)</option>
          <option value="SALE">SALE (Shipment Out)</option>
          <option value="RETURN">RETURN (Inward Stock)</option>
          <option value="DAMAGE">DAMAGE (Write-off)</option>
          <option value="ADJUSTMENT_IN">ADJUSTMENT IN (Correction)</option>
          <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT (Correction)</option>
        </select>
      </div>

      {/* Quantity Input */}
      <div>
        <label htmlFor="quantity" className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
          Quantity (Units)
        </label>
        <input
          type="number"
          id="quantity"
          name="quantity"
          min="1"
          required
          placeholder="e.g. 25"
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Reference Number */}
      <div>
        <label htmlFor="referenceNumber" className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
          Reference Number
        </label>
        <input
          type="text"
          id="referenceNumber"
          name="referenceNumber"
          placeholder="PO-2026-003, INV-129"
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Remarks */}
      <div>
        <label htmlFor="remarks" className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
          Remarks
        </label>
        <textarea
          id="remarks"
          name="remarks"
          rows={2}
          placeholder="Detailed notes on stock movement..."
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
        />
      </div>

      {/* Success/Error Feedback */}
      {state.error && (
        <div className="flex items-start gap-2.5 bg-red-950/20 border border-red-900/50 rounded-xl p-3.5 text-xs text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="font-semibold leading-relaxed">{state.error}</p>
        </div>
      )}
      {state.success && state.message && (
        <div className="flex items-start gap-2.5 bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-3.5 text-xs text-emerald-400">
          <PlusCircle size={16} className="mt-0.5 shrink-0 animate-bounce" />
          <p className="font-semibold leading-relaxed">{state.message}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-amber-500 text-neutral-950 py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {isPending ? 'Saving to Ledger...' : 'Post to Stock Ledger'}
      </button>
    </form>
  );
}
