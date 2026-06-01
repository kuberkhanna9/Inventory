// migration.ts
// Operational migration utility that normalizes SKU-centric mock_db.json into Product -> Color -> Size -> Variant tables.
// Safely preserves all transaction records and backfills APPROVED stock requests to maintain complete ledger immutability.
import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'mock_db.json');

export function runRelationalMigration() {
  if (!fs.existsSync(FILE_PATH)) return { success: false, message: 'No mock database found to migrate.' };

  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const db = JSON.parse(raw);

    // Check if migration is already applied
    const isNormalized = db.colors && db.sizes && db.variants && db.variants.length > 0 && 'colorId' in db.variants[0];
    
    if (isNormalized) {
      // Ensure all variants have a barcode backfilled if they are missing
      let mutated = false;
      db.variants = db.variants.map((v: any, index: number) => {
        if (!v.barcode) {
          v.barcode = '11000000000' + (index + 1);
          mutated = true;
        }
        return v;
      });
      if (mutated) {
        fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
      }
      return { success: true, message: 'Database is already fully normalized and migrated (barcodes verified).' };
    }

    console.log('Starting LJK relational data migration...');

    // Initialize new collections
    db.colors = db.colors || [];
    db.sizes = db.sizes || [];
    db.requests = db.requests || [];

    // Seed predefined system profiles
    db.profiles = [
      {
        id: 'usr-superadmin',
        fullName: 'Super Admin',
        role: 'SUPERADMIN',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-accounts',
        fullName: 'Accounts Department',
        role: 'ACCOUNTS',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-inventory',
        fullName: 'Inventory Department',
        role: 'INVENTORY',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-retail',
        fullName: 'Retail Department',
        role: 'RETAIL',
        active: true,
        createdAt: new Date().toISOString()
      }
    ];

    // Populate colors and sizes from existing variants
    if (db.variants && db.variants.length > 0) {
      const oldVariants = [...db.variants];
      const newVariants: any[] = [];

      // 1. Compile colors & sizes
      oldVariants.forEach((v: any, index: number) => {
        // Color mapping
        let colorObj = db.colors.find((c: any) => c.productId === v.productId && c.colorName === v.color);
        if (!colorObj) {
          colorObj = {
            id: 'col-' + Math.random().toString(36).substr(2, 9),
            productId: v.productId,
            colorName: v.color
          };
          db.colors.push(colorObj);
        }

        // Size mapping
        let sizeObj = db.sizes.find((s: any) => s.productId === v.productId && s.sizeName === v.size);
        if (!sizeObj) {
          sizeObj = {
            id: 'sz-' + Math.random().toString(36).substr(2, 9),
            productId: v.productId,
            sizeName: v.size
          };
          db.sizes.push(sizeObj);
        }

        // 2. Re-create variant with relational keys and unique barcode
        newVariants.push({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          barcode: v.barcode || ('11000000000' + (index + 1)),
          colorId: colorObj.id,
          sizeId: sizeObj.id,
          costPrice: Number(v.costPrice),
          wholesalePrice: Number(v.wholesalePrice),
          mrp: Number(v.mrp),
          rackLocation: v.rackLocation,
          active: v.active !== false,
          createdAt: v.createdAt || new Date().toISOString()
        });
      });

      db.variants = newVariants;
    }

    // 3. Backfill APPROVED requests for existing transactions
    if (db.transactions && db.transactions.length > 0) {
      const newTransactions: any[] = [];

      db.transactions.forEach((tx: any) => {
        // Create an approved stock request for this past transaction
        const requestId = 'req-' + Math.random().toString(36).substr(2, 9);
        const request = {
          id: requestId,
          variantId: tx.variantId,
          requestType: tx.transactionType,
          quantity: tx.quantity,
          referenceNumber: tx.referenceNumber,
          invoiceNumber: tx.referenceNumber?.startsWith('INV-') ? tx.referenceNumber : undefined,
          remarks: tx.remarks || 'Migrated past transaction',
          createdBy: tx.createdBy || 'admin-id-1234',
          status: 'APPROVED',
          reviewedBy: 'admin-id-1234',
          reviewedAt: tx.createdAt || new Date().toISOString(),
          createdAt: tx.createdAt || new Date().toISOString()
        };

        db.requests.push(request);

        // Keep transaction tied to request
        newTransactions.push({
          id: tx.id,
          requestId: requestId,
          variantId: tx.variantId,
          transactionType: tx.transactionType,
          quantity: tx.quantity,
          referenceNumber: tx.referenceNumber,
          invoiceNumber: request.invoiceNumber,
          remarks: tx.remarks,
          createdBy: tx.createdBy || 'admin-id-1234',
          createdAt: tx.createdAt || new Date().toISOString()
        });
      });

      db.transactions = newTransactions;
    }

    // Save normalized database
    fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
    console.log('Migration completed successfully! database normalized.');
    return { success: true, message: 'Migration successfully completed. All records normalized.' };

  } catch (err: any) {
    console.error('Migration failed:', err);
    return { success: false, message: `Migration error: ${err.message}` };
  }
}
