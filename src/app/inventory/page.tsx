import { getSession } from '@/utils/session';
import { 
  getComputedInventory, 
  getProducts, 
  getTransactions, 
  getPriceHistory, 
  getStockRequests 
} from '@/utils/db';
import Navigation from '@/components/Navigation';
import InventoryView from '@/components/InventoryView';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function InventoryPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  const inventoryItems = await getComputedInventory();
  const allProducts = await getProducts();
  
  const allTransactions = await getTransactions();
  const allPriceHistory = await getPriceHistory();
  const allRequests = await getStockRequests();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
      <Navigation user={user} />
      
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        <InventoryView 
          userRole={user.role} 
          inventoryItems={inventoryItems} 
          products={allProducts} 
          allTransactions={allTransactions}
          allPriceHistory={allPriceHistory}
          allRequests={allRequests}
        />
      </main>
    </div>
  );
}
