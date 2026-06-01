'use client';

import { useState, useActionState, useTransition } from 'react';
import { StockRequest } from '@/utils/types';
import { createStockRequestAction, reviewStockRequestAction } from '@/app/actions';
import { 
  AlertTriangle, 
  CheckCircle, 
  XOctagon, 
  Clock, 
  Plus, 
  Inbox, 
  FileText,
  User,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileCheck,
  Lock
} from 'lucide-react';

interface RequestsTerminalProps {
  user: {
    id: string;
    fullName: string;
    role: 'SUPERADMIN' | 'ACCOUNTS' | 'INVENTORY' | 'RETAIL';
  };
  requests: StockRequest[];
  variants: any[];
}

const initialFormState = {
  success: false,
  error: '',
  message: ''
};

export default function RequestsTerminal({ user, requests, variants }: RequestsTerminalProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [requestType, setRequestType] = useState<string>('STOCK_IN');
  const [invoiceRequired, setInvoiceRequired] = useState(false);

  const [formState, formAction, isPending] = useActionState(createStockRequestAction, initialFormState);
  const [isReviewing, startTransition] = useTransition();

  const isSuperAdmin = user.role === 'SUPERADMIN';
  const isInventory = user.role === 'INVENTORY';
  const isRetail = user.role === 'RETAIL';

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const pastRequests = requests.filter(r => r.status !== 'PENDING');

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setRequestType(val);
    setInvoiceRequired(val === 'SALE');
  };

  const handleReview = (id: string, status: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
      const res = await reviewStockRequestAction(id, status);
      if (res.error) {
        alert(res.error);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Requests Manager</h1>
        <p className="text-slate-500 text-xs mt-1">Submit finished goods warehouse dispatches and review pending ledger audits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Create Stock Request Panel (Inventory Dept and SuperAdmin only) */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-max">
          <div className="mb-6">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
              <Plus size={16} className="text-slate-700" />
              <span>New Stock Request</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Submit a ledger movement for audit approval.</p>
          </div>

          {(isSuperAdmin || isInventory) ? (
            <form action={formAction} className="space-y-4 text-xs">
              {/* Select SKU dropdown */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Select Knitwear SKU</label>
                <select
                  name="variantId"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                >
                  <option value="">Choose variant SKU...</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.sku} ({v.productName} - {v.colorName} / {v.sizeName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Request Type select */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Stock Operation Type</label>
                <select
                  name="requestType"
                  required
                  onChange={handleTypeChange}
                  value={requestType}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                >
                  <option value="STOCK_IN">STOCK IN (Production Batch)</option>
                  <option value="SALE">SALE (Wholesale Shipment)</option>
                  <option value="DAMAGE_REPAIRABLE">DAMAGE (Loose stitching, Label, Stain)</option>
                  <option value="DAMAGE_NON_REPAIRABLE">DAMAGE (Fabric defect, Scrap)</option>
                  <option value="ADJUSTMENT_IN">ADJUSTMENT IN (Correction)</option>
                  <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT (Correction)</option>
                </select>
              </div>

              {/* Quantity input */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Quantity (pcs)</label>
                <input
                  type="number"
                  name="quantity"
                  required
                  min="1"
                  placeholder="e.g. 100"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                />
              </div>

              {/* Invoice Number (Sales only) */}
              {invoiceRequired && (
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Invoice Number (Required for sales)</label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    required
                    placeholder="INV-2026-004"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                  />
                </div>
              )}

              {/* Reference number */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Reference Number / PO</label>
                <input
                  type="text"
                  name="referenceNumber"
                  placeholder="e.g. PO-1004"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Remarks</label>
                <textarea
                  name="remarks"
                  rows={2}
                  placeholder="Add batch notes, stain report details..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800 resize-none"
                />
              </div>

              {/* Feedback messages */}
              {formState.error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 leading-relaxed font-semibold">
                  {formState.error}
                </div>
              )}
              {formState.success && formState.message && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3 leading-relaxed font-semibold">
                  {formState.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Submitting request...' : isSuperAdmin ? 'Post Stock Ledger (Auto-Approve)' : 'Submit Request for Approval'}
              </button>
            </form>
          ) : (
            <div className="border border-slate-200 bg-slate-50 p-6 rounded-2xl text-center space-y-4 shadow-inner">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-sm">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-700">Access Restricted</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Your current department role ({user.role}) is restricted from creating ledger requests.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Requests Terminals (Pending Workflow & Histories) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            {/* Terminal Switcher */}
            <div className="flex gap-4 border-b border-slate-200 pb-3 mb-6">
              <button
                onClick={() => setActiveTab('pending')}
                className={`text-xs font-black uppercase tracking-wider pb-1.5 border-b-2 cursor-pointer transition-all ${
                  activeTab === 'pending'
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <span>Pending Approvals ({pendingRequests.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`text-xs font-black uppercase tracking-wider pb-1.5 border-b-2 cursor-pointer transition-all ${
                  activeTab === 'history'
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <span>Audit History ({pastRequests.length})</span>
              </button>
            </div>

            {/* Terminal contents */}
            {activeTab === 'pending' ? (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                    <Inbox size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-400">All ledger requests are fully audited!</p>
                  </div>
                ) : (
                  pendingRequests.map(req => {
                    const v = variants.find(x => x.id === req.variantId);
                    return (
                      <div 
                        key={req.id} 
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-900 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md">
                              {req.requestType}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v ? v.sku : 'N/A'}</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 mt-1">
                            {v ? v.productName : 'Style template'} ({v ? v.colorName : ''} / {v ? v.sizeName : ''}) • <span className="font-extrabold text-slate-900">{req.quantity} pcs</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            PO/Ref: {req.referenceNumber || 'N/A'} {req.invoiceNumber ? `• Invoice: ${req.invoiceNumber}` : ''}
                          </p>
                          <span className="text-[10px] text-slate-500 font-semibold block italic">Notes: "{req.remarks || 'No remarks provided.'}"</span>
                          <span className="text-[9px] text-slate-400 font-medium block">
                            Requested by operator on {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Review Buttons (SuperAdmin only) */}
                        {isSuperAdmin ? (
                          <div className="flex gap-2 w-full md:w-auto">
                            <button
                              onClick={() => handleReview(req.id, 'REJECTED')}
                              disabled={isReviewing}
                              className="flex-1 md:flex-none bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 text-[11px] font-black px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleReview(req.id, 'APPROVED')}
                              disabled={isReviewing}
                              className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                            >
                              Approve
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                            <Clock size={12} className="text-amber-500 animate-spin" />
                            <span>Awaiting SuperAdmin review</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {pastRequests.length === 0 ? (
                  <p className="text-slate-400 text-xs py-12 text-center">No past operational request logs found.</p>
                ) : (
                  pastRequests.map(req => {
                    const v = variants.find(x => x.id === req.variantId);
                    const isApproved = req.status === 'APPROVED';
                    return (
                      <div key={req.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase text-slate-800 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-md">
                              {req.requestType}
                            </span>
                            <span className="font-extrabold text-slate-700">{v ? v.sku : 'N/A'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">Quantity: {req.quantity} pcs • PO: {req.referenceNumber || 'N/A'}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Reviewed on {new Date(req.reviewedAt || '').toLocaleDateString()}</span>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isApproved 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                              : 'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            {isApproved ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            <span>{req.status}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
