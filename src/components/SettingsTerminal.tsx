'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, Database, FileSpreadsheet, Lock, Sparkles, CheckCircle, Info } from 'lucide-react';

interface SettingsTerminalProps {
  user: {
    fullName: string;
    role: 'SUPERADMIN' | 'ACCOUNTS' | 'INVENTORY' | 'RETAIL';
  };
}

export default function SettingsTerminal({ user }: SettingsTerminalProps) {
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const triggerMigration = () => {
    setMigrationStatus('');
    startTransition(async () => {
      // Manual sync trigger call
      const response = await fetch('/api/migrate', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setMigrationStatus('Relational database normalization successfully synced! Colors, sizes, and approved workflows are up-to-date.');
      } else {
        setMigrationStatus(`Migration notice: ${data.message}`);
      }
    });
  };

  const matrix = [
    {
      action: 'Create Products & SKU variants',
      sa: '✓ Full',
      acc: '✕ No',
      inv: '✕ No',
      ret: '✕ No',
    },
    {
      action: 'Edit variant values & MRP prices',
      sa: '✓ Full',
      acc: '✕ No',
      inv: '✕ No',
      ret: '✕ No',
    },
    {
      action: 'Create ledger stock requests',
      sa: '✓ Full',
      acc: '✕ No',
      inv: '✓ Yes',
      ret: '✕ No',
    },
    {
      action: 'Approve pending requests',
      sa: '✓ Full',
      acc: '✕ No',
      inv: '✕ No',
      ret: '✕ No',
    },
    {
      action: 'Upload bulk Excel workbooks',
      sa: '✓ Full',
      acc: '✕ No',
      inv: '✓ Yes',
      ret: '✕ No',
    },
    {
      action: 'View Cost price & Valuations',
      sa: '✓ Full',
      acc: '✓ Yes',
      inv: '✓ Yes',
      ret: '✕ Restricted',
    },
    {
      action: 'Search inventory SKU catalog',
      sa: '✓ Full',
      acc: '✓ Yes',
      inv: '✓ Yes',
      ret: '✓ Yes',
    },
    {
      action: 'Export audit valuation reports',
      sa: '✓ Full',
      acc: '✓ Yes',
      inv: '✕ No',
      ret: '✕ No',
    }
  ];

  return (
    <div className="space-y-8 text-xs">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings & Controls</h1>
        <p className="text-slate-500 text-xs mt-1">Configure data normalization migrations and view system role privileges.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: DB Migrations Trigger */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-max space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Database size={16} className="text-slate-600" />
            <span>Database Normalization</span>
          </div>
          <p className="text-slate-500 leading-relaxed font-semibold">
            Trigger a manual database synchronization check. Normalizes SKU-centric models into a relational color/size structure.
          </p>

          {user.role === 'SUPERADMIN' ? (
            <button
              onClick={triggerMigration}
              disabled={isPending}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isPending ? 'Migrating mock database...' : 'Run Relational Migration'}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold">
              <Lock size={12} />
              <span>Only SuperAdmins can trigger migrations</span>
            </div>
          )}

          {migrationStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl leading-relaxed font-bold flex gap-1.5 items-start">
              <CheckCircle size={14} className="mt-0.5 shrink-0" />
              <span>{migrationStatus}</span>
            </div>
          )}
        </div>

        {/* Right column: Permission Matrix */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Operational Permission Matrix</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-slate-50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                  <th className="px-4 py-3">ERP Action / Command</th>
                  <th className="px-4 py-3 text-center bg-slate-100">SuperAdmin</th>
                  <th className="px-4 py-3 text-center">Accounts</th>
                  <th className="px-4 py-3 text-center">Inventory</th>
                  <th className="px-4 py-3 text-center">Retail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-100/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.action}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-100/20">{row.sa}</td>
                    <td className={`px-4 py-3 text-center font-bold ${row.acc.startsWith('✓') ? 'text-slate-800' : 'text-slate-400'}`}>{row.acc}</td>
                    <td className={`px-4 py-3 text-center font-bold ${row.inv.startsWith('✓') ? 'text-slate-800' : 'text-slate-400'}`}>{row.inv}</td>
                    <td className={`px-4 py-3 text-center font-bold ${
                      row.ret === '✕ Restricted' ? 'text-red-500 font-extrabold' : 
                      row.ret.startsWith('✓') ? 'text-slate-800' : 'text-slate-400'
                    }`}>{row.ret}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
