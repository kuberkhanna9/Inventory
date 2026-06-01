import { getSession } from '@/utils/session';
import { getStockRequests, getVariants, getProducts } from '@/utils/db';
import Navigation from '@/components/Navigation';
import RequestsTerminal from '@/components/RequestsTerminal';
import { redirect } from 'next/navigation';

export const revalidate = 0; // live stock recalculations

export default async function RequestsPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  const requests = await getStockRequests();
  const variants = await getVariants();
  const products = await getProducts();

  // Map product names to variants for display
  const enrichedVariants = variants.map(v => {
    const p = products.find(prod => prod.id === v.productId);
    return {
      ...v,
      productName: p ? p.productName : 'Unknown Style'
    };
  });

  if (user.role !== 'SUPERADMIN' && user.role !== 'INVENTORY') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
        <Navigation user={user} />
        <main className="flex-1 p-6 lg:p-10 flex items-center justify-center">
          <div className="text-center space-y-2.5 max-w-sm bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
            <h2 className="text-base font-black text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Your account department role ({user.role}) is unauthorized to view or manage stock requests.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
      <Navigation user={user} />
      
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        <RequestsTerminal 
          user={user} 
          requests={requests} 
          variants={enrichedVariants} 
        />
      </main>
    </div>
  );
}
