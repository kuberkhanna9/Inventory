import { getSession } from '@/utils/session';
import { getDashboardStats } from '@/utils/db';
import Navigation from '@/components/Navigation';
import { 
  Package, 
  Layers, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Wrench,
  Trash2,
  FileCheck,
  XSquare,
  Clock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const revalidate = 0; // live reload stock calculations

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  const stats = await getDashboardStats();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const isRetail = user.role === 'RETAIL';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
      <Navigation user={user} />
      
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Top Operational Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lall Ji Knitwears Inventory Management System</h1>
            <p className="text-slate-500 text-xs mt-1">Operational status, live ledger balances, and pending department approvals.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm">
            <UserCheck size={12} className="text-slate-500" />
            <span>Profile: <span className="text-slate-900 font-extrabold uppercase">{user.role}</span></span>
          </div>
        </div>

        {/* 1. Inventory Summary Section */}
        <section className="space-y-4 mb-8">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Inventory Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Products</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalProducts}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Variants (SKUs)</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalVariants}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm border-l-4 border-l-emerald-500">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ready Stock</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalReady} <span className="text-xs text-slate-500 font-semibold">pcs</span></span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm border-l-4 border-l-amber-500">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Repairable Stock</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalRepairable} <span className="text-xs text-slate-500 font-semibold">pcs</span></span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm border-l-4 border-l-slate-400">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scrap Stock</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalScrap} <span className="text-xs text-slate-500 font-semibold">pcs</span></span>
            </div>
          </div>
        </section>

        {/* 2. Valuation Grid (Restricted: Hidden for Retail Department!) */}
        {!isRetail && (
          <section className="space-y-4 mb-8">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Inventory Valuation (Cost Base)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cost Value</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">{formatCurrency(stats.costVal)}</span>
                </div>
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600"><DollarSign size={16} /></div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wholesale Value</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">{formatCurrency(stats.wholesaleVal)}</span>
                </div>
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600"><TrendingUp size={16} /></div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retail Value (MRP)</span>
                  <span className="text-xl font-black text-slate-950 mt-1 block">{formatCurrency(stats.retailVal)}</span>
                </div>
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600"><Layers size={16} /></div>
              </div>
            </div>
          </section>
        )}

        {/* 3. Approvals Grid */}
        <section className="space-y-4 mb-8">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tally Operations & Approvals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              href="/requests"
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Requests</span>
                <span className={`text-xl font-black mt-1 block ${stats.pendingRequestsCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-900'}`}>
                  {stats.pendingRequestsCount}
                </span>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100"><AlertTriangle size={16} /></div>
            </Link>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Today</span>
                <span className="text-xl font-black text-emerald-600 mt-1 block">{stats.approvedTodayCount}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"><FileCheck size={16} /></div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejected Today</span>
                <span className="text-xl font-black text-red-600 mt-1 block">{stats.rejectedTodayCount}</span>
              </div>
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100"><XSquare size={16} /></div>
            </div>
          </div>
        </section>

        {/* 4. Recent Activities Feed */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Recent Activity Log</h2>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="space-y-3">
              {stats.recentActivity.length === 0 ? (
                <p className="text-slate-400 text-xs py-4 text-center">No system operations logged yet today.</p>
              ) : (
                stats.recentActivity.map((log: any) => (
                  <div key={log.id} className="flex justify-between items-start gap-4 text-xs pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 uppercase text-[9px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md">
                          {log.action}
                        </span>
                        <span className="text-slate-400 uppercase text-[9px] font-bold">{log.module}</span>
                      </div>
                      <p className="text-slate-600 font-semibold mt-1">{log.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium font-mono">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
