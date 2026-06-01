import { getSession } from '@/utils/session';
import { getComputedInventory, getTransactions, getVariants } from '@/utils/db';
import Navigation from '@/components/Navigation';
import ReportsView from '@/components/ReportsView';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  if (user.role === 'RETAIL' || user.role === 'INVENTORY') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
        <Navigation user={user} />
        <main className="flex-1 p-6 lg:p-10 flex items-center justify-center">
          <div className="text-center space-y-2.5 max-w-sm bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
            <h2 className="text-base font-black text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Your account department role ({user.role}) is unauthorized to compile valuations or stock movement reports.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const inventoryItems = await getComputedInventory();
  const allTransactions = await getTransactions();
  const allVariants = await getVariants();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
      <Navigation user={user} />
      
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        <ReportsView 
          userRole={user.role} 
          inventoryItems={inventoryItems} 
          transactions={allTransactions}
          variants={allVariants}
        />
      </main>
    </div>
  );
}
