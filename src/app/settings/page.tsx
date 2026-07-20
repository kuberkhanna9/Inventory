import { getSession } from '@/utils/session';
import { getApprovalPolicies } from '@/utils/db';
import Navigation from '@/components/Navigation';
import SettingsTerminal from '@/components/SettingsTerminal';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  // Fetch approval policies (will be empty array if table doesn't exist yet)
  let policies: any[] = [];
  try {
    policies = await getApprovalPolicies();
  } catch {
    // Table may not exist yet if migration hasn't been run
    policies = [];
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:flex-row">
      <Navigation user={user} />
      
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        <SettingsTerminal user={user} policies={policies} />
      </main>
    </div>
  );
}
