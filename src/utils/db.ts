// src/utils/db.ts
// Production-hardened database adapter.
// Interfaces exclusively with Supabase PostgreSQL via Drizzle ORM.

import { db as pgDb } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { 
  Profile, 
  Product, 
  ProductColor, 
  ProductSize, 
  ProductVariant, 
  StockRequest, 
  StockTransaction, 
  PriceHistory, 
  AuditLog,
  compileStockForVariant,
  ComputedStock
} from './types';

// -----------------------------------------------------------------------------
// CORE BUSINESS LOGIC FOR CALCULATING STOCK
// -----------------------------------------------------------------------------
export function getVariantStock(variantId: string, transactions: StockTransaction[]): ComputedStock {
  return compileStockForVariant(variantId, transactions);
}

// -----------------------------------------------------------------------------
// CRUD LAYER (Direct Drizzle/Postgres ONLY - Mock-DB fallback removed)
// -----------------------------------------------------------------------------

// Profiles
export async function getProfileById(id: string): Promise<Profile | null> {
  const res = await pgDb.select().from(schema.profiles).where(eq(schema.profiles.id, id)).limit(1);
  if (res.length === 0) return null;
  return {
    id: res[0].id,
    fullName: res[0].fullName,
    role: res[0].role as any,
    active: res[0].active,
    createdAt: res[0].createdAt.toISOString()
  };
}

// Products
export async function getProducts(): Promise<Product[]> {
  const res = await pgDb.select().from(schema.products).where(eq(schema.products.active, true));
  return res.map(p => ({
    id: p.id,
    productName: p.productName,
    category: p.category,
    subcategory: p.subcategory || undefined,
    description: p.description || undefined,
    brand: p.brand || undefined,
    season: p.season || undefined,
    active: p.active,
    createdAt: p.createdAt.toISOString()
  }));
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'active'>): Promise<Product> {
  const res = await pgDb.insert(schema.products).values({
    productName: data.productName,
    category: data.category,
    subcategory: data.subcategory || null,
    description: data.description || null,
    brand: data.brand || null,
    season: data.season || null
  }).returning();

  const product = res[0];
  await logAudit('usr-superadmin', 'CREATE', 'PRODUCTS', `Created style template "${product.productName}"`);
  return {
    id: product.id,
    productName: product.productName,
    category: product.category,
    subcategory: product.subcategory || undefined,
    description: product.description || undefined,
    brand: product.brand || undefined,
    season: product.season || undefined,
    active: product.active,
    createdAt: product.createdAt.toISOString()
  };
}

// Colors and Sizes
export async function getProductColors(productId: string): Promise<ProductColor[]> {
  const res = await pgDb.select().from(schema.productColors).where(eq(schema.productColors.productId, productId));
  return res.map(c => ({
    id: c.id,
    productId: c.productId,
    colorName: c.colorName
  }));
}

export async function getProductSizes(productId: string): Promise<ProductSize[]> {
  const res = await pgDb.select().from(schema.productSizes).where(eq(schema.productSizes.productId, productId));
  return res.map(s => ({
    id: s.id,
    productId: s.productId,
    sizeName: s.sizeName
  }));
}

// Variants (SKUs)
export async function getVariants(productId?: string): Promise<ProductVariant[]> {
  let q = pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.active, true));
  if (productId) {
    q = pgDb.select().from(schema.productVariants).where(
      and(
        eq(schema.productVariants.active, true),
        eq(schema.productVariants.productId, productId)
      )
    );
  }
  const res = await q;
  return res.map(v => ({
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    barcode: v.sku, // standard mapping fallback
    colorId: v.colorId,
    sizeId: v.sizeId,
    costPrice: Number(v.costPrice),
    wholesalePrice: Number(v.wholesalePrice),
    mrp: Number(v.mrp),
    rackLocation: v.rackLocation || undefined,
    active: v.active,
    createdAt: v.createdAt.toISOString()
  }));
}

export async function createVariant(data: Omit<ProductVariant, 'id' | 'createdAt' | 'active' | 'colorId' | 'sizeId'> & { colorName: string; sizeName: string }): Promise<ProductVariant> {
  // 1. Enforce barcode uniqueness
  const existingVar = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.sku, data.sku)).limit(1);
  if (existingVar.length > 0) {
    throw new Error(`SKU error: SKU "${data.sku}" is already registered.`);
  }

  // 2. Find or create color
  let colorId: string;
  const existingColor = await pgDb.select().from(schema.productColors).where(
    and(
      eq(schema.productColors.productId, data.productId),
      eq(schema.productColors.colorName, data.colorName)
    )
  ).limit(1);

  if (existingColor.length > 0) {
    colorId = existingColor[0].id;
  } else {
    const colorRes = await pgDb.insert(schema.productColors).values({
      productId: data.productId,
      colorName: data.colorName
    }).returning();
    colorId = colorRes[0].id;
  }

  // 3. Find or create size
  let sizeId: string;
  const existingSize = await pgDb.select().from(schema.productSizes).where(
    and(
      eq(schema.productSizes.productId, data.productId),
      eq(schema.productSizes.sizeName, data.sizeName)
    )
  ).limit(1);

  if (existingSize.length > 0) {
    sizeId = existingSize[0].id;
  } else {
    const sizeRes = await pgDb.insert(schema.productSizes).values({
      productId: data.productId,
      sizeName: data.sizeName
    }).returning();
    sizeId = sizeRes[0].id;
  }

  // 4. Insert variant SKU
  const res = await pgDb.insert(schema.productVariants).values({
    productId: data.productId,
    sku: data.sku,
    colorId,
    sizeId,
    costPrice: String(data.costPrice),
    wholesalePrice: String(data.wholesalePrice),
    mrp: String(data.mrp),
    rackLocation: data.rackLocation || null
  }).returning();

  const v = res[0];
  await logAudit('usr-superadmin', 'CREATE', 'VARIANTS', `Registered new variant SKU "${v.sku}"`);
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    barcode: v.sku,
    colorId: v.colorId,
    sizeId: v.sizeId,
    costPrice: Number(v.costPrice),
    wholesalePrice: Number(v.wholesalePrice),
    mrp: Number(v.mrp),
    rackLocation: v.rackLocation || undefined,
    active: v.active,
    createdAt: v.createdAt.toISOString()
  };
}

// Stock Requests
export async function getStockRequests(): Promise<StockRequest[]> {
  const res = await pgDb.select().from(schema.stockRequests).orderBy(desc(schema.stockRequests.createdAt));
  return res.map(r => ({
    id: r.id,
    variantId: r.variantId,
    requestType: r.requestType as any,
    quantity: r.quantity,
    referenceNumber: r.referenceNumber || undefined,
    invoiceNumber: r.invoiceNumber || undefined,
    remarks: r.remarks || undefined,
    createdBy: r.createdBy,
    status: r.status as any,
    reviewedBy: r.reviewedBy || undefined,
    reviewedAt: r.reviewedAt?.toISOString() || undefined,
    createdAt: r.createdAt.toISOString()
  }));
}

export async function createStockRequest(
  data: Omit<StockRequest, 'id' | 'createdAt' | 'status' | 'createdBy'>,
  userId: string
): Promise<{ success: boolean; error?: string; request?: StockRequest }> {
  // 1. Fetch variant and calculate live stock from transactions
  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, data.variantId)).limit(1);
  if (varRes.length === 0) return { success: false, error: 'SKU variant not found' };
  const variant = varRes[0];

  const allTxRes = await pgDb.select().from(schema.stockTransactions);
  const transactions = allTxRes.map(t => ({
    id: t.id,
    requestId: t.requestId,
    variantId: t.variantId,
    transactionType: t.transactionType as any,
    quantity: t.quantity,
    referenceNumber: t.referenceNumber || undefined,
    invoiceNumber: t.invoiceNumber || undefined,
    remarks: t.remarks || undefined,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString()
  }));

  const currentStock = compileStockForVariant(data.variantId, transactions);
  const qty = Number(data.quantity);
  const outTypes = ['SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_OUT'];
  
  if (outTypes.includes(data.requestType)) {
    if (currentStock.readyStock < qty) {
      return {
        success: false,
        error: `Insufficient stock balance! Requested ${qty} units, but only ${currentStock.readyStock} are in Ready Stock for SKU ${variant.sku}.`
      };
    }
  }

  const res = await pgDb.insert(schema.stockRequests).values({
    variantId: data.variantId,
    requestType: data.requestType as any,
    quantity: qty,
    referenceNumber: data.referenceNumber || null,
    invoiceNumber: data.invoiceNumber || null,
    remarks: data.remarks || null,
    createdBy: userId
  }).returning();

  const r = res[0];
  const newReq: StockRequest = {
    id: r.id,
    variantId: r.variantId,
    requestType: r.requestType as any,
    quantity: r.quantity,
    referenceNumber: r.referenceNumber || undefined,
    invoiceNumber: r.invoiceNumber || undefined,
    remarks: r.remarks || undefined,
    createdBy: r.createdBy,
    status: r.status as any,
    createdAt: r.createdAt.toISOString()
  };

  await logAudit(
    userId,
    'REQUEST_CREATE',
    'STOCK_REQUESTS',
    `Created ${data.requestType} request for ${qty} units of SKU "${variant.sku}"`
  );

  return { success: true, request: newReq };
}

export async function reviewStockRequest(
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
  userId: string
): Promise<{ success: boolean; error?: string; request?: StockRequest }> {
  const reqRes = await pgDb.select().from(schema.stockRequests).where(eq(schema.stockRequests.id, requestId)).limit(1);
  if (reqRes.length === 0) return { success: false, error: 'Stock request not found.' };
  const req = reqRes[0];

  if (req.status !== 'PENDING') return { success: false, error: 'Request is already reviewed.' };

  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, req.variantId)).limit(1);
  if (varRes.length === 0) return { success: false, error: 'SKU variant not found.' };
  const variant = varRes[0];

  if (status === 'APPROVED') {
    const allTxRes = await pgDb.select().from(schema.stockTransactions);
    const transactions = allTxRes.map(t => ({
      id: t.id,
      requestId: t.requestId,
      variantId: t.variantId,
      transactionType: t.transactionType as any,
      quantity: t.quantity,
      referenceNumber: t.referenceNumber || undefined,
      invoiceNumber: t.invoiceNumber || undefined,
      remarks: t.remarks || undefined,
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString()
    }));

    const currentStock = compileStockForVariant(req.variantId, transactions);
    const qty = Number(req.quantity);
    const outTypes = ['SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_OUT'];

    if (outTypes.includes(req.requestType as any) && currentStock.readyStock < qty) {
      return {
        success: false,
        error: `Action aborted! Stock deficit occurred: requested ${qty} units, but only ${currentStock.readyStock} are in stock.`
      };
    }

    // Insert approved ledger transaction entry!
    await pgDb.insert(schema.stockTransactions).values({
      requestId: req.id,
      variantId: req.variantId,
      transactionType: req.requestType as any,
      quantity: qty,
      referenceNumber: req.referenceNumber || null,
      invoiceNumber: req.invoiceNumber || null,
      remarks: req.remarks || null,
      createdBy: req.createdBy
    });
  }

  // Update request review fields
  const updatedRes = await pgDb.update(schema.stockRequests).set({
    status: status as any,
    reviewedBy: userId,
    reviewedAt: new Date()
  }).where(eq(schema.stockRequests.id, requestId)).returning();

  const r = updatedRes[0];
  const updatedReq: StockRequest = {
    id: r.id,
    variantId: r.variantId,
    requestType: r.requestType as any,
    quantity: r.quantity,
    referenceNumber: r.referenceNumber || undefined,
    invoiceNumber: r.invoiceNumber || undefined,
    remarks: r.remarks || undefined,
    createdBy: r.createdBy,
    status: r.status as any,
    reviewedBy: r.reviewedBy || undefined,
    reviewedAt: r.reviewedAt?.toISOString() || undefined,
    createdAt: r.createdAt.toISOString()
  };

  await logAudit(
    userId,
    status === 'APPROVED' ? 'REQUEST_APPROVE' : 'REQUEST_REJECT',
    'STOCK_REQUESTS',
    `${status} ${req.requestType} request for ${req.quantity} units of SKU "${variant.sku}"`
  );

  return { success: true, request: updatedReq };
}

// -----------------------------------------------------------------------------
// DERIVED SYSTEM VIEW & SEARCH COMPUTATION
// -----------------------------------------------------------------------------

export interface ComputedInventoryItem {
  variantId: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  category: string;
  colorName: string;
  sizeName: string;
  rackLocation: string;
  readyStock: number;
  repairableStock: number;
  scrapStock: number;
  costPrice: number;
  wholesalePrice: number;
  mrp: number;
  inventoryCostValue: number;
  inventoryWholesaleValue: number;
  inventoryRetailValue: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export async function getComputedInventory(): Promise<ComputedInventoryItem[]> {
  const allTx = await getTransactions();
  
  const results: ComputedInventoryItem[] = [];
  const variantsList = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.active, true));
  const productsList = await pgDb.select().from(schema.products).where(eq(schema.products.active, true));
  const colorsList = await pgDb.select().from(schema.productColors);
  const sizesList = await pgDb.select().from(schema.productSizes);

  for (const v of variantsList) {
    const prod = productsList.find(p => p.id === v.productId);
    if (!prod) continue;

    const colorObj = colorsList.find(c => c.id === v.colorId);
    const sizeObj = sizesList.find(s => s.id === v.sizeId);

    const stock = compileStockForVariant(v.id, allTx);
    const cost = Number(v.costPrice);
    const wholesale = Number(v.wholesalePrice);
    const mrp = Number(v.mrp);

    let status: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
    if (stock.readyStock === 0) {
      status = 'Out of Stock';
    } else if (stock.readyStock <= 5) {
      status = 'Low Stock';
    }

    results.push({
      variantId: v.id,
      productId: prod.id,
      sku: v.sku,
      barcode: v.sku,
      productName: prod.productName,
      category: prod.category,
      colorName: colorObj ? colorObj.colorName : 'Unknown',
      sizeName: sizeObj ? sizeObj.sizeName : 'Unknown',
      rackLocation: v.rackLocation || 'N/A',
      readyStock: stock.readyStock,
      repairableStock: stock.repairableStock,
      scrapStock: stock.scrapStock,
      costPrice: cost,
      wholesalePrice: wholesale,
      mrp,
      inventoryCostValue: stock.readyStock * cost,
      inventoryWholesaleValue: stock.readyStock * wholesale,
      inventoryRetailValue: stock.readyStock * mrp,
      status
    });
  }
  return results;
}

// Dashboard statistics
export async function getDashboardStats() {
  const inventory = await getComputedInventory();
  
  const productsList = await pgDb.select().from(schema.products).where(eq(schema.products.active, true));
  const requests = await pgDb.select().from(schema.stockRequests);
  const auditLogsList = await pgDb.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(10);

  const totalProducts = productsList.length;
  const totalVariants = inventory.length;
  let totalReady = 0;
  let totalRepairable = 0;
  let totalScrap = 0;
  
  let costVal = 0;
  let wholesaleVal = 0;
  let retailVal = 0;
  
  for (const item of inventory) {
    totalReady += item.readyStock;
    totalRepairable += item.repairableStock;
    totalScrap += item.scrapStock;

    costVal += item.inventoryCostValue;
    wholesaleVal += item.inventoryWholesaleValue;
    retailVal += item.inventoryRetailValue;
  }
  
  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const approvedTodayCount = requests.filter(r => r.status === 'APPROVED' && r.reviewedAt?.toISOString().startsWith(todayStr)).length;
  const rejectedTodayCount = requests.filter(r => r.status === 'REJECTED' && r.reviewedAt?.toISOString().startsWith(todayStr)).length;

  const recentActivity = auditLogsList.map(a => ({
    id: a.id,
    userId: a.userId || undefined,
    action: a.action,
    module: a.module,
    description: a.description,
    createdAt: a.createdAt.toISOString()
  }));

  return {
    totalProducts,
    totalVariants,
    totalReady,
    totalRepairable,
    totalScrap,
    costVal,
    wholesaleVal,
    retailVal,
    pendingRequestsCount,
    approvedTodayCount,
    rejectedTodayCount,
    recentActivity
  };
}

// Audit Logs
export async function getAuditLogs(): Promise<AuditLog[]> {
  const res = await pgDb.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt));
  return res.map(a => ({
    id: a.id,
    userId: a.userId || undefined,
    action: a.action,
    module: a.module,
    description: a.description,
    createdAt: a.createdAt.toISOString()
  }));
}

export async function logAudit(userId: string, action: string, module: string, description: string): Promise<AuditLog> {
  const res = await pgDb.insert(schema.auditLogs).values({
    userId: userId.startsWith('usr-') ? null : userId, // safety mapping check
    action,
    module,
    description
  }).returning();
  const a = res[0];
  return {
    id: a.id,
    userId: a.userId || undefined,
    action: a.action,
    module: a.module,
    description: a.description,
    createdAt: a.createdAt.toISOString()
  };
}

export async function getPriceHistory(variantId?: string): Promise<PriceHistory[]> {
  let q = pgDb.select().from(schema.priceHistory).orderBy(desc(schema.priceHistory.createdAt));
  if (variantId) {
    q = pgDb.select().from(schema.priceHistory).where(eq(schema.priceHistory.variantId, variantId)).orderBy(desc(schema.priceHistory.createdAt));
  }
  const res = await q;
  return res.map(p => ({
    id: p.id,
    variantId: p.variantId,
    oldCostPrice: Number(p.oldCostPrice),
    newCostPrice: Number(p.newCostPrice),
    oldWholesalePrice: Number(p.oldWholesalePrice),
    newWholesalePrice: Number(p.newWholesalePrice),
    oldMrp: Number(p.oldMrp),
    newMrp: Number(p.newMrp),
    changedBy: p.changedBy,
    createdAt: p.createdAt.toISOString()
  }));
}

export async function getTransactions(variantId?: string): Promise<StockTransaction[]> {
  let q = pgDb.select().from(schema.stockTransactions).orderBy(desc(schema.stockTransactions.createdAt));
  if (variantId) {
    q = pgDb.select().from(schema.stockTransactions).where(eq(schema.stockTransactions.variantId, variantId)).orderBy(desc(schema.stockTransactions.createdAt));
  }
  const res = await q;
  return res.map(t => ({
    id: t.id,
    requestId: t.requestId,
    variantId: t.variantId,
    transactionType: t.transactionType as any,
    quantity: t.quantity,
    referenceNumber: t.referenceNumber || undefined,
    invoiceNumber: t.invoiceNumber || undefined,
    remarks: t.remarks || undefined,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString()
  }));
}

export async function updateVariantPricing(
  variantId: string,
  costPrice: number,
  wholesalePrice: number,
  mrp: number,
  userId: string
): Promise<boolean> {
  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId)).limit(1);
  if (varRes.length === 0) return false;
  const variant = varRes[0];

  // Log price history entry
  await pgDb.insert(schema.priceHistory).values({
    variantId,
    oldCostPrice: variant.costPrice,
    newCostPrice: String(costPrice),
    oldWholesalePrice: variant.wholesalePrice,
    newWholesalePrice: String(wholesalePrice),
    oldMrp: variant.mrp,
    newMrp: String(mrp),
    changedBy: userId
  });

  await pgDb.update(schema.productVariants).set({
    costPrice: String(costPrice),
    wholesalePrice: String(wholesalePrice),
    mrp: String(mrp)
  }).where(eq(schema.productVariants.id, variantId));

  await logAudit(userId, 'PRICE_UPDATE', 'PRICING', `Updated pricing values for SKU "${variant.sku}"`);
  return true;
}
