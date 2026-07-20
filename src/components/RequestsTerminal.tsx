'use client';

import { useState, useActionState, useTransition } from 'react';
import { StockRequest } from '@/utils/types';
import { 
  createStockRequestAction, 
  reviewStockRequestAction, 
  bulkReviewRequestsAction, 
  exportSelectedRequestsAction,
  approveAllPendingAction 
} from '@/app/actions';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Plus, 
  Inbox, 
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
  Download,
  Square,
  CheckSquare,
  MinusSquare,
  X,
  ZapOff
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

// Status badge component
function StatusBadge({ status, approvalMethod }: { status: string; approvalMethod?: string | null }) {
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border bg-amber-50 text-amber-600 border-amber-200">
        <Clock size={10} className="animate-pulse" />
        <span>Pending</span>
      </span>
    );
  }

  if (status === 'APPROVED' && approvalMethod === 'AUTO') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border bg-violet-50 text-violet-600 border-violet-200">
        <Sparkles size={10} />
        <span>Auto Approved</span>
      </span>
    );
  }

  if (status === 'APPROVED' && approvalMethod === 'BULK') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200">
        <CheckCircle2 size={10} />
        <span>Bulk Approved</span>
      </span>
    );
  }

  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-200">
        <CheckCircle2 size={10} />
        <span>Approved</span>
      </span>
    );
  }

  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border bg-red-50 text-red-600 border-red-200">
        <XCircle size={10} />
        <span>Rejected</span>
      </span>
    );
  }

  return null;
}

export default function RequestsTerminal({ user, requests, variants }: RequestsTerminalProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [requestType, setRequestType] = useState<string>('STOCK_IN');
  const [invoiceRequired, setInvoiceRequired] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState<{ action: 'APPROVED' | 'REJECTED' } | null>(null);
  const [showApproveAllConfirm, setShowApproveAllConfirm] = useState(false);

  const [formState, formAction, isPending] = useActionState(createStockRequestAction, initialFormState);
  const [isReviewing, startTransition] = useTransition();
  const [isBulkProcessing, startBulkTransition] = useTransition();

  const isSuperAdmin = user.role === 'SUPERADMIN';
  const isInventory = user.role === 'INVENTORY';
  const isAccounts = user.role === 'ACCOUNTS';

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

  // Selection logic
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map(r => r.id)));
    }
  };

  const isAllSelected = pendingRequests.length > 0 && selectedIds.size === pendingRequests.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < pendingRequests.length;
  const hasSelection = selectedIds.size > 0;

  // Bulk actions
  const handleBulkAction = (action: 'APPROVED' | 'REJECTED') => {
    setShowBulkConfirm({ action });
  };

  const executeBulkAction = () => {
    if (!showBulkConfirm) return;
    const { action } = showBulkConfirm;
    setShowBulkConfirm(null);
    setBulkFeedback(null);

    startBulkTransition(async () => {
      const ids = Array.from(selectedIds);
      const result = await bulkReviewRequestsAction(ids, action);

      if (result.success) {
        setBulkFeedback({ type: 'success', message: result.message || 'Operation completed!' });
        setSelectedIds(new Set());
        setTimeout(() => setBulkFeedback(null), 4000);
      } else {
        setBulkFeedback({ type: 'error', message: result.error || 'Bulk operation failed.' });
      }
    });
  };

  // Approve All Pending logic
  const executeApproveAllPending = () => {
    setShowApproveAllConfirm(false);
    setBulkFeedback(null);

    startBulkTransition(async () => {
      const result = await approveAllPendingAction();

      if (result.success) {
        setBulkFeedback({ type: 'success', message: result.message || 'All eligible requests approved!' });
        setSelectedIds(new Set());
        setTimeout(() => setBulkFeedback(null), 5000);
      } else {
        setBulkFeedback({ type: 'error', message: result.error || 'Approve All operation failed.' });
      }
    });
  };

  const handleExportSelected = () => {
    startBulkTransition(async () => {
      const ids = Array.from(selectedIds);
      const result = await exportSelectedRequestsAction(ids);

      if (result.success && result.data) {
        const headers = Object.keys(result.data[0] || {}).join(',');
        const rows = result.data.map(r => Object.values(r).map(v => `"${v}"`).join(','));
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock_requests_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        setBulkFeedback({ type: 'success', message: `Exported ${result.data.length} requests to CSV!` });
        setTimeout(() => setBulkFeedback(null), 3000);
      } else {
        setBulkFeedback({ type: 'error', message: result.error || 'Export failed.' });
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

      {/* Bulk Feedback */}
      {bulkFeedback && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          bulkFeedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {bulkFeedback.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          <span>{bulkFeedback.message}</span>
        </div>
      )}

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
            <div className="flex gap-4 border-b border-slate-200 pb-3 mb-6 items-center justify-between">
              <div className="flex gap-4">
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

              {/* Approve All Pending Button (SuperAdmin only) */}
              {isSuperAdmin && activeTab === 'pending' && pendingRequests.length > 0 && (
                <button
                  onClick={() => setShowApproveAllConfirm(true)}
                  disabled={isBulkProcessing}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                >
                  Approve All Pending
                </button>
              )}
            </div>

            {/* Terminal contents */}
            {activeTab === 'pending' ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {/* Select All header (SuperAdmin only) */}
                {isSuperAdmin && pendingRequests.length > 0 && (
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                    >
                      {isAllSelected ? (
                        <CheckSquare size={14} className="text-slate-700" />
                      ) : isSomeSelected ? (
                        <MinusSquare size={14} className="text-slate-500" />
                      ) : (
                        <Square size={14} className="text-slate-300" />
                      )}
                      <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    {hasSelection && (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {selectedIds.size} selected
                      </span>
                    )}
                  </div>
                )}

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                    <Inbox size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-400">All ledger requests are fully audited!</p>
                  </div>
                ) : (
                  pendingRequests.map(req => {
                    const v = variants.find(x => x.id === req.variantId);
                    const isSelected = selectedIds.has(req.id);
                    return (
                      <div 
                        key={req.id} 
                        className={`p-4 border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-150 ${
                          isSelected
                            ? 'bg-blue-50/60 border-blue-200 ring-1 ring-blue-200'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Checkbox (SuperAdmin only) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => toggleSelect(req.id)}
                              className="mt-0.5 cursor-pointer shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-blue-600" />
                              ) : (
                                <Square size={16} className="text-slate-300 hover:text-slate-400" />
                              )}
                            </button>
                          )}

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase text-slate-900 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md">
                                {req.requestType}
                              </span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v ? v.sku : 'N/A'}</span>
                              <StatusBadge status={req.status} approvalMethod={req.approvalMethod} />
                            </div>
                            <p className="text-xs font-bold text-slate-800 mt-1">
                              {v ? v.productName : 'Style template'} ({v ? v.colorName : ''} / {v ? v.sizeName : ''}) • <span className="font-extrabold text-slate-900">{req.quantity} pcs</span>
                            </p>
                            <p className="text-[10px] text-slate-400">
                              PO/Ref: {req.referenceNumber || 'N/A'} {req.invoiceNumber ? `• Invoice: ${req.invoiceNumber}` : ''}
                            </p>
                            <span className="text-[10px] text-slate-500 font-semibold block italic">Notes: &quot;{req.remarks || 'No remarks provided.'}&quot;</span>
                            <span className="text-[9px] text-slate-400 font-medium block">
                              Requested by operator on {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Review Buttons (SuperAdmin only, not in view-only mode) */}
                        {isSuperAdmin && !isAccounts ? (
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
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {pastRequests.length === 0 ? (
                  <p className="text-slate-400 text-xs py-12 text-center">No past operational request logs found.</p>
                ) : (
                  pastRequests.map(req => {
                    const v = variants.find(x => x.id === req.variantId);
                    return (
                      <div key={req.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-extrabold uppercase text-slate-800 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-md">
                              {req.requestType}
                            </span>
                            <span className="font-extrabold text-slate-700">{v ? v.sku : 'N/A'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">Quantity: {req.quantity} pcs • PO: {req.referenceNumber || 'N/A'}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            Reviewed on {new Date(req.approvedAt || req.reviewedAt || '').toLocaleDateString()}
                            {req.approvalMethod && (
                              <span className="ml-1 text-slate-500">• Method: {req.approvalMethod}</span>
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={req.status} approvalMethod={req.approvalMethod} />
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

      {/* Floating Bulk Action Toolbar */}
      {isSuperAdmin && hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-slate-700 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center text-[11px] font-black">
                {selectedIds.size}
              </div>
              <span className="text-[11px] font-bold text-slate-300">
                request{selectedIds.size > 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="w-px h-7 bg-slate-700" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('APPROVED')}
                disabled={isBulkProcessing}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle size={12} />
                <span>Approve</span>
              </button>
              <button
                onClick={() => handleBulkAction('REJECTED')}
                disabled={isBulkProcessing}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <XCircle size={12} />
                <span>Reject</span>
              </button>
              <button
                onClick={handleExportSelected}
                disabled={isBulkProcessing}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black uppercase px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download size={12} />
                <span>Export</span>
              </button>
            </div>

            <div className="w-px h-7 bg-slate-700" />

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X size={16} />
            </button>

            {isBulkProcessing && (
              <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
            )}
          </div>
        </div>
      )}

      {/* Bulk Confirm Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                showBulkConfirm.action === 'APPROVED'
                  ? 'bg-emerald-100 border border-emerald-200'
                  : 'bg-red-100 border border-red-200'
              }`}>
                {showBulkConfirm.action === 'APPROVED' ? (
                  <CheckCircle size={20} className="text-emerald-600" />
                ) : (
                  <XCircle size={20} className="text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Bulk {showBulkConfirm.action === 'APPROVED' ? 'Approve' : 'Reject'}?
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {selectedIds.size} request{selectedIds.size > 1 ? 's' : ''} will be {showBulkConfirm.action.toLowerCase()}
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-xl text-[10px] font-semibold leading-relaxed border ${
              showBulkConfirm.action === 'APPROVED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertTriangle size={12} className="inline mr-1" />
              {showBulkConfirm.action === 'APPROVED'
                ? 'All selected requests will be approved and their stock transactions will be posted to the immutable ledger. Each request will generate an individual audit log entry.'
                : 'All selected requests will be rejected. No stock transactions will be created. Each rejection will be individually audited.'}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkConfirm(null)}
                className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                className={`flex-1 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm ${
                  showBulkConfirm.action === 'APPROVED'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Confirm {showBulkConfirm.action === 'APPROVED' ? 'Approve' : 'Reject'} All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve All Pending Confirm Modal */}
      {showApproveAllConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Approve all pending stock requests?</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Approve all {pendingRequests.length} pending requests instantly
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
              This will batch-approve all pending requests inside a secure database transaction. Requests with insufficient warehouse ready stock will be skipped automatically, and all approvals will generate separate audit logs.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowApproveAllConfirm(false)}
                className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeApproveAllPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                Confirm Approve All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
