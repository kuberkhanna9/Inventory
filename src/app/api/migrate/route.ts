import { NextResponse } from 'next/server';
import { runRelationalMigration } from '@/utils/migration';
import { getSession } from '@/utils/session';

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  try {
    const result = runRelationalMigration();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

