// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-export' || process.env.NEXT_PHASE?.includes('build');

if (!connectionString) {
  if (isBuilding) {
    console.warn("DATABASE_URL is missing during build phase. Standard compilation bypass is active.");
  } else {
    throw new Error(
      "CRITICAL: DATABASE_URL environment variable is missing! LJK Inventory ERP requires a valid Supabase PostgreSQL connection string to start. Local JSON mock fallbacks are completely disabled."
    );
  }
}

// Ensure prefetch is disabled for transactions compatibility (e.g., Supabase transaction pooling mode)
const client = (isBuilding && !connectionString) ? null : postgres(connectionString!, { prepare: false });

export const db = client ? drizzle(client, { schema }) : (null as any);


