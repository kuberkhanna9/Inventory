// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let connectionString = process.env.DATABASE_URL;
let variableUsed = 'DATABASE_URL';

if (!connectionString && process.env.POSTGRES_URL) {
  connectionString = process.env.POSTGRES_URL;
  variableUsed = 'POSTGRES_URL';
}
if (!connectionString && process.env.POSTGRES_PRISMA_URL) {
  connectionString = process.env.POSTGRES_PRISMA_URL;
  variableUsed = 'POSTGRES_PRISMA_URL';
}

const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-export' || process.env.NEXT_PHASE?.includes('build');

if (!isBuilding) {
  // Temporary diagnostic startup logging
  console.log("=== LJK DATABASE STARTUP DIAGNOSTICS ===");
  console.log("Process Environment Keys Present:");
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'}`);
  console.log(`  POSTGRES_URL: ${process.env.POSTGRES_URL ? 'PRESENT' : 'MISSING'}`);
  console.log(`  POSTGRES_PRISMA_URL: ${process.env.POSTGRES_PRISMA_URL ? 'PRESENT' : 'MISSING'}`);
  console.log(`  POSTGRES_URL_NON_POOLING: ${process.env.POSTGRES_URL_NON_POOLING ? 'PRESENT' : 'MISSING'}`);

  if (connectionString) {
    try {
      const cleanUrl = connectionString.replace('postgresql://', 'http://').replace('postgres://', 'http://');
      const parsed = new URL(cleanUrl);
      console.log("Database Variable Used:", variableUsed);
      console.log("Database Host:", parsed.hostname);
    } catch (err) {
      console.log("Database Variable Used:", variableUsed);
      console.log("Database Host: <invalid connection string format>");
    }
  } else {
    console.log("Database Variable Used: NONE (connection string is empty)");
    console.log("Database Host: NONE");
  }
  console.log("=========================================");
}

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




