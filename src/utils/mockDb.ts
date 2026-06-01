// mockDb.ts
// In-memory or JSON-based local database fallback to let the app run immediately without configuring Supabase.
import fs from 'fs';
import path from 'path';

import { Profile, Product, ProductVariant, StockTransaction, PriceHistory, AuditLog } from './types';
import { runRelationalMigration } from './migration';
export type { Profile, Product, ProductVariant, StockTransaction, PriceHistory, AuditLog };

const FILE_PATH = path.join(process.cwd(), 'mock_db.json');

const DEFAULT_DB = {
  profiles: [
    {
      id: 'usr-superadmin',
      fullName: 'Super Admin',
      role: 'SUPERADMIN' as const,
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-accounts',
      fullName: 'Accounts Department',
      role: 'ACCOUNTS' as const,
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-inventory',
      fullName: 'Inventory Department',
      role: 'INVENTORY' as const,
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-retail',
      fullName: 'Retail Department',
      role: 'RETAIL' as const,
      active: true,
      createdAt: new Date().toISOString()
    }
  ],
  products: [] as Product[],
  variants: [] as ProductVariant[],
  transactions: [] as StockTransaction[],
  priceHistory: [] as PriceHistory[],
  auditLogs: [
    {
      id: 'a-1',
      userId: 'usr-superadmin',
      action: 'INITIALIZE',
      module: 'SYSTEM',
      description: 'System database initialized cleanly for production release.',
      createdAt: new Date().toISOString()
    }
  ]
};

export function getMockDb() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  }
  try {
    runRelationalMigration();
  } catch (e) {
    console.error('Relational migration hook skipped:', e);
  }
  try {
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return DEFAULT_DB;
  }
}

export function saveMockDb(data: any) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
