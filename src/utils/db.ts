// src/utils/db.ts
// Production-hardened database adapter.
// Interfaces exclusively with Supabase PostgreSQL via Drizzle ORM.

import { db as pgDb } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
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
  ApprovalPolicy,
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

import { FIXED_ACCOUNTS } from './session';

// Profiles
export async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const res = await pgDb.select().from(schema.profiles).where(eq(schema.profiles.id, id)).limit(1);
    if (res.length > 0) {
      return {
        id: res[0].id,
        fullName: res[0].fullName,
        role: res[0].role as any,
        active: res[0].active,
        createdAt: res[0].createdAt.toISOString()
      };
    }
  } catch (err) {
    // Database query failed, fallback to predefined account check
  }

  const fixed = FIXED_ACCOUNTS.find(acc => acc.id === id);
  if (fixed) {
    return {
      id: fixed.id,
      fullName: fixed.fullName,
      role: fixed.role,
      active: fixed.active,
      createdAt: new Date().toISOString()
    };
  }

  return null;
}

// Products
export async function getProducts(): Promise<Product[]> {
  const res = await pgDb.select().from(schema.products).where(eq(schema.products.active, true));
  return res.map((p: any) => ({
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
  return res.map((c: any) => ({
    id: c.id,
    productId: c.productId,
    colorName: c.colorName
  }));
}

export async function getProductSizes(productId: string): Promise<ProductSize[]> {
  const res = await pgDb.select().from(schema.productSizes).where(eq(schema.productSizes.productId, productId));
  return res.map((s: any) => ({
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
  return res.map((v: any) => ({
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    barcode: v.barcode || v.sku,
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

export async function createVariant(data: Omit<ProductVariant, 'id' | 'createdAt' | 'active' | 'colorId' | 'sizeId' | 'barcode'> & { colorName: string; sizeName: string; barcode?: string }): Promise<ProductVariant> {
  // 1. Enforce SKU uniqueness
  const existingVar = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.sku, data.sku)).limit(1);
  if (existingVar.length > 0) {
    throw new Error(`SKU error: SKU "${data.sku}" is already registered.`);
  }

  // Check barcode uniqueness if provided
  if (data.barcode) {
    const existingBarcode = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.barcode, data.barcode)).limit(1);
    if (existingBarcode.length > 0) {
      throw new Error(`Barcode error: Barcode "${data.barcode}" is already registered.`);
    }
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
    barcode: data.barcode || null,
    colorId,
    sizeId,
    costPrice: String(data.costPrice),
    wholesalePrice: String(data.wholesalePrice),
    mrp: String(data.mrp),
    rackLocation: data.rackLocation || null
  }).returning();

  const v = res[0];
  await logAudit('usr-superadmin', 'CREATE', 'VARIANTS', `Registered new variant SKU "${v.sku}" (Barcode: "${v.barcode || v.sku}")`);
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    barcode: v.barcode || v.sku,
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
  return res.map((r: any) => ({
    id: r.id,
    variantId: r.variantId,
    requestType: r.requestType as any,
    quantity: r.quantity,
    referenceNumber: r.referenceNumber || undefined,
    invoiceNumber: r.invoiceNumber || undefined,
    remarks: r.remarks || undefined,
    createdBy: r.createdBy,
    status: r.status as any,
    approvalMethod: r.approvalMethod || undefined,
    reviewedBy: r.reviewedBy || undefined,
    reviewedAt: r.reviewedAt?.toISOString() || undefined,
    approvedBy: r.approvedBy || undefined,
    approvedAt: r.approvedAt?.toISOString() || undefined,
    originalWsp: r.originalWsp ? Number(r.originalWsp) : undefined,
    originalMrp: r.originalMrp ? Number(r.originalMrp) : undefined,
    requestedWsp: r.requestedWsp ? Number(r.requestedWsp) : undefined,
    requestedMrp: r.requestedMrp ? Number(r.requestedMrp) : undefined,
    priceChangeStatus: r.priceChangeStatus as any,
    createdAt: r.createdAt.toISOString()
  }));
}

export async function createStockRequest(
  data: Omit<StockRequest, 'id' | 'createdAt' | 'status' | 'createdBy'> & {
    originalWsp?: number;
    originalMrp?: number;
    requestedWsp?: number;
    requestedMrp?: number;
    priceChangeStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  },
  userId: string
): Promise<{ success: boolean; error?: string; request?: StockRequest; autoApproved?: boolean }> {
  // 1. Fetch variant and calculate live stock from transactions
  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, data.variantId)).limit(1);
  if (varRes.length === 0) return { success: false, error: 'SKU variant not found' };
  const variant = varRes[0];

  const profile = await getProfileById(userId);
  const isSuperAdmin = profile ? profile.role === 'SUPERADMIN' : false;

  const qty = Number(data.quantity);
  if (qty <= 0) return { success: false, error: 'Quantity must be greater than zero.' };

  // Validate custom pricing if provided
  const hasPriceChange = 
    (data.requestedWsp !== undefined && Number(data.requestedWsp) !== Number(variant.wholesalePrice)) ||
    (data.requestedMrp !== undefined && Number(data.requestedMrp) !== Number(variant.mrp));

  if (hasPriceChange) {
    if (data.requestedWsp !== undefined && Number(data.requestedWsp) < 0) {
      return { success: false, error: 'Wholesale Price (WSP) cannot be negative.' };
    }
    if (data.requestedMrp !== undefined && data.requestedWsp !== undefined && Number(data.requestedMrp) < Number(data.requestedWsp)) {
      return { success: false, error: 'MRP cannot be less than Wholesale Price (WSP).' };
    }
    if (!data.remarks || data.remarks.trim() === '') {
      return { success: false, error: 'Remarks are mandatory when WSP or MRP is modified.' };
    }
  }

  const allTxRes = await pgDb.select().from(schema.stockTransactions);
  const transactions = allTxRes.map((t: any) => ({
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
  const outTypes = ['SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_OUT'];
  
  if (outTypes.includes(data.requestType)) {
    if (currentStock.readyStock < qty) {
      return {
        success: false,
        error: `Insufficient stock balance! Requested ${qty} units, but only ${currentStock.readyStock} are in Ready Stock for SKU ${variant.sku}.`
      };
    }
  }

  // Determine initial status: Non-SuperAdmin rate change goes to PENDING_RATE_APPROVAL
  const statusVal = (hasPriceChange && !isSuperAdmin) ? 'PENDING_RATE_APPROVAL' : 'PENDING';
  const priceChangeStatusVal = hasPriceChange ? 'PENDING' : null;

  let res;
  try {
    res = await pgDb.insert(schema.stockRequests).values({
      variantId: data.variantId,
      requestType: data.requestType as any,
      quantity: qty,
      referenceNumber: data.referenceNumber || null,
      invoiceNumber: data.invoiceNumber || null,
      remarks: data.remarks || null,
      createdBy: userId,
      status: statusVal as any,
      originalWsp: hasPriceChange ? String(variant.wholesalePrice) : null,
      originalMrp: hasPriceChange ? String(variant.mrp) : null,
      requestedWsp: hasPriceChange ? String(data.requestedWsp) : null,
      requestedMrp: hasPriceChange ? String(data.requestedMrp) : null,
      priceChangeStatus: priceChangeStatusVal
    }).returning();
  } catch (err: any) {
    return handleDatabaseError(err, 'createStockRequest');
  }

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
    originalWsp: r.originalWsp ? Number(r.originalWsp) : undefined,
    originalMrp: r.originalMrp ? Number(r.originalMrp) : undefined,
    requestedWsp: r.requestedWsp ? Number(r.requestedWsp) : undefined,
    requestedMrp: r.requestedMrp ? Number(r.requestedMrp) : undefined,
    priceChangeStatus: r.priceChangeStatus as any,
    approvalMethod: r.approvalMethod || undefined,
    createdAt: r.createdAt.toISOString()
  };

  const username = profile ? profile.fullName : 'System';

  if (hasPriceChange) {
    // Generate audit log for price modification
    const auditDesc = `Price Modification: SKU "${variant.sku}" WSP: ${variant.wholesalePrice} -> ${data.requestedWsp}, MRP: ${variant.mrp} -> ${data.requestedMrp} by ${username}. Status: ${statusVal}`;
    await logAudit(userId, 'PRICE_MODIFY', 'INVENTORY', auditDesc);
  }

  await logAudit(
    userId,
    'REQUEST_CREATE',
    'INVENTORY',
    `Created ${data.requestType} request for ${qty} units of SKU "${variant.sku}"`
  );

  // 2. Check approval policy for auto-approval (Only if not pending rate approval!)
  if (statusVal !== 'PENDING_RATE_APPROVAL') {
    // If SuperAdmin and hasPriceChange, immediately approve
    if (isSuperAdmin && hasPriceChange) {
      try {
        await pgDb.insert(schema.stockTransactions).values({
          requestId: r.id,
          variantId: r.variantId,
          transactionType: r.requestType as any,
          quantity: qty,
          referenceNumber: r.referenceNumber || null,
          invoiceNumber: r.invoiceNumber || null,
          remarks: r.remarks || null,
          createdBy: r.createdBy
        });

        await pgDb.update(schema.stockRequests).set({
          status: 'APPROVED' as any,
          priceChangeStatus: 'APPROVED',
          approvalMethod: 'MANUAL',
          reviewedBy: userId,
          reviewedAt: new Date(),
          approvedBy: userId,
          approvedAt: new Date()
        }).where(eq(schema.stockRequests.id, r.id));

        const auditDesc = `Entity: stock_requests | Entity ID: ${r.id} | Username: ${username} | Description: SuperAdmin created request with rate change, auto-approved.`;
        await logAudit(userId, 'MANUALLY_APPROVED', 'INVENTORY', auditDesc);

        newReq.status = 'APPROVED';
        newReq.priceChangeStatus = 'APPROVED';
        newReq.approvalMethod = 'MANUAL';
        newReq.approvedBy = userId;
        newReq.approvedAt = new Date().toISOString();
        return { success: true, request: newReq, autoApproved: true };
      } catch (err: any) {
        console.error('SuperAdmin immediate rate-change approval failed:', err.message);
      }
    }

    const shouldAutoApprove = await checkAutoApproval(data.requestType, qty);
    if (shouldAutoApprove) {
      // Auto-approve: insert ledger transaction, update request status, log audit
      try {
        await pgDb.insert(schema.stockTransactions).values({
          requestId: r.id,
          variantId: r.variantId,
          transactionType: r.requestType as any,
          quantity: qty,
          referenceNumber: r.referenceNumber || null,
          invoiceNumber: r.invoiceNumber || null,
          remarks: r.remarks || null,
          createdBy: r.createdBy
        });

        await pgDb.update(schema.stockRequests).set({
          status: 'APPROVED' as any,
          approvalMethod: 'AUTO',
          reviewedBy: userId,
          reviewedAt: new Date(),
          approvedBy: userId,
          approvedAt: new Date()
        }).where(eq(schema.stockRequests.id, r.id));

        const auditDesc = `Entity: stock_requests | Entity ID: ${r.id} | Username: ${username} | Description: Auto-approved ${data.requestType} request for ${qty} units of SKU "${variant.sku}" per approval policy`;
        
        await logAudit(userId, 'AUTO_APPROVED', 'INVENTORY', auditDesc);

        newReq.status = 'APPROVED';
        newReq.approvalMethod = 'AUTO';
        newReq.approvedBy = userId;
        newReq.approvedAt = new Date().toISOString();
        return { success: true, request: newReq, autoApproved: true };
      } catch (err: any) {
        console.error('Auto-approval failed, keeping request as PENDING:', err.message);
      }
    }
  }

  return { success: true, request: newReq, autoApproved: false };
}

export async function reviewStockRequest(
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
  userId: string,
  approvalMethod: 'MANUAL' | 'BULK' = 'MANUAL',
  priceAction: 'APPROVE_PRICE' | 'REJECT_PRICE' | 'APPROVE_WITHOUT_PRICE' | 'NONE' = 'NONE'
): Promise<{ success: boolean; error?: string; request?: StockRequest }> {
  const reqRes = await pgDb.select().from(schema.stockRequests).where(eq(schema.stockRequests.id, requestId)).limit(1);
  if (reqRes.length === 0) return { success: false, error: 'Stock request not found.' };
  const req = reqRes[0];

  if (req.status !== 'PENDING' && req.status !== 'PENDING_RATE_APPROVAL') {
    return { success: false, error: 'Request is already reviewed.' };
  }

  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, req.variantId)).limit(1);
  if (varRes.length === 0) return { success: false, error: 'SKU variant not found.' };
  const variant = varRes[0];

  let finalStatus: 'APPROVED' | 'REJECTED' = status;
  let finalPriceStatus: 'APPROVED' | 'REJECTED' | null = req.priceChangeStatus as any;

  if (priceAction === 'APPROVE_PRICE') {
    finalStatus = 'APPROVED';
    finalPriceStatus = 'APPROVED';
  } else if (priceAction === 'REJECT_PRICE') {
    finalStatus = 'REJECTED';
    finalPriceStatus = 'REJECTED';
  } else if (priceAction === 'APPROVE_WITHOUT_PRICE') {
    finalStatus = 'APPROVED';
    finalPriceStatus = 'REJECTED';
  }

  let updatedRes;
  try {
    if (finalStatus === 'APPROVED') {
      const allTxRes = await pgDb.select().from(schema.stockTransactions);
      const transactions = allTxRes.map((t: any) => ({
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

    // Update request review fields with approval method
    updatedRes = await pgDb.update(schema.stockRequests).set({
      status: finalStatus as any,
      priceChangeStatus: finalPriceStatus,
      approvalMethod: approvalMethod,
      reviewedBy: userId,
      reviewedAt: new Date(),
      approvedBy: userId,
      approvedAt: new Date()
    }).where(eq(schema.stockRequests.id, requestId)).returning();
  } catch (err: any) {
    return handleDatabaseError(err, 'reviewStockRequest');
  }

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
    originalWsp: r.originalWsp ? Number(r.originalWsp) : undefined,
    originalMrp: r.originalMrp ? Number(r.originalMrp) : undefined,
    requestedWsp: r.requestedWsp ? Number(r.requestedWsp) : undefined,
    requestedMrp: r.requestedMrp ? Number(r.requestedMrp) : undefined,
    priceChangeStatus: r.priceChangeStatus as any,
    approvalMethod: r.approvalMethod || undefined,
    reviewedBy: r.reviewedBy || undefined,
    reviewedAt: r.reviewedAt?.toISOString() || undefined,
    approvedBy: r.approvedBy || undefined,
    approvedAt: r.approvedAt?.toISOString() || undefined,
    createdAt: r.createdAt.toISOString()
  };

  const actionType = finalStatus === 'APPROVED' 
    ? (approvalMethod === 'BULK' ? 'BULK_APPROVED' : 'MANUALLY_APPROVED')
    : 'REJECTED';

  const profile = await getProfileById(userId);
  const username = profile ? profile.fullName : 'System';
  
  let auditDesc = `Entity: stock_requests | Entity ID: ${req.id} | Username: ${username} | Description: Reviewed ${req.requestType} request for ${req.quantity} units of SKU "${variant.sku}" -> ${finalStatus}`;
  if (priceAction !== 'NONE' && req.requestedWsp) {
    auditDesc += ` | PriceAction: ${priceAction} | SKU: ${variant.sku} | Orig WSP: ${req.originalWsp} | Req WSP: ${req.requestedWsp} | Orig MRP: ${req.originalMrp} | Req MRP: ${req.requestedMrp} | Status: ${finalPriceStatus}`;
    
    // Also log a specific PRICE_MODIFY audit record
    await logAudit(
      userId,
      priceAction === 'APPROVE_PRICE' ? 'PRICE_APPROVED' : 'PRICE_REJECTED',
      'INVENTORY',
      `Price modification review: SKU "${variant.sku}" | Orig WSP: ${req.originalWsp} | Req WSP: ${req.requestedWsp} | Orig MRP: ${req.originalMrp} | Req MRP: ${req.requestedMrp} | Approved By: ${username} | Status: ${finalPriceStatus}`
    );
  }

  await logAudit(userId, actionType, 'INVENTORY', auditDesc);

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
  active: boolean;
}

export async function getComputedInventory(includeDeleted?: boolean): Promise<ComputedInventoryItem[]> {
  const allTx = await getTransactions();
  
  const results: ComputedInventoryItem[] = [];
  const variantsList = includeDeleted
    ? await pgDb.select().from(schema.productVariants)
    : await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.active, true));
  const productsList = await pgDb.select().from(schema.products).where(eq(schema.products.active, true));
  const colorsList = await pgDb.select().from(schema.productColors);
  const sizesList = await pgDb.select().from(schema.productSizes);

  for (const v of variantsList) {
    const prod = productsList.find((p: any) => p.id === v.productId);
    if (!prod) continue;

    const colorObj = colorsList.find((c: any) => c.id === v.colorId);
    const sizeObj = sizesList.find((s: any) => s.id === v.sizeId);

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
      barcode: v.barcode || v.sku,
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
      status,
      active: v.active
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
  
  const pendingRequestsCount = requests.filter((r: any) => r.status === 'PENDING').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const approvedTodayCount = requests.filter((r: any) => r.status === 'APPROVED' && r.reviewedAt?.toISOString().startsWith(todayStr)).length;
  const rejectedTodayCount = requests.filter((r: any) => r.status === 'REJECTED' && r.reviewedAt?.toISOString().startsWith(todayStr)).length;

  const recentActivity = auditLogsList.map((a: any) => ({
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
  return res.map((a: any) => ({
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
  return res.map((p: any) => ({
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
  return res.map((t: any) => ({
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

export async function deleteVariant(variantId: string, userId: string): Promise<boolean> {
  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId)).limit(1);
  if (varRes.length === 0) return false;
  const variant = varRes[0];

  // Update variant active = false
  await pgDb.update(schema.productVariants)
    .set({ active: false })
    .where(eq(schema.productVariants.id, variantId));

  // Log audit trail
  await logAudit(
    userId,
    'DELETE_SKU',
    'CATALOG',
    `Soft deleted SKU "${variant.sku}" (Barcode: "${variant.barcode || variant.sku}")`
  );

  return true;
}

export async function bulkDeleteVariants(variantIds: string[], userId: string): Promise<boolean> {
  if (variantIds.length === 0) return false;

  // Fetch variant details for audit log before deletion
  const variants = await pgDb.select().from(schema.productVariants)
    .where(inArray(schema.productVariants.id, variantIds));

  if (variants.length === 0) return false;

  // Set active = false
  await pgDb.update(schema.productVariants)
    .set({ active: false })
    .where(inArray(schema.productVariants.id, variantIds));

  const deletedSkus = variants.map((v: any) => v.sku);

  // Log bulk audit log
  await logAudit(
    userId,
    'BULK_DELETE_SKU',
    'CATALOG',
    `Bulk soft deleted ${variants.length} SKUs: ${deletedSkus.join(', ')}`
  );

  return true;
}

export async function restoreVariant(variantId: string, userId: string): Promise<boolean> {
  const varRes = await pgDb.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId)).limit(1);
  if (varRes.length === 0) return false;
  const variant = varRes[0];

  // Update variant active = true
  await pgDb.update(schema.productVariants)
    .set({ active: true })
    .where(eq(schema.productVariants.id, variantId));

  // Log audit trail
  await logAudit(
    userId,
    'RESTORE_SKU',
    'CATALOG',
    `Restored SKU "${variant.sku}"`
  );

  return true;
}

export async function bulkRestoreVariants(variantIds: string[], userId: string): Promise<boolean> {
  if (variantIds.length === 0) return false;

  const variants = await pgDb.select().from(schema.productVariants)
    .where(inArray(schema.productVariants.id, variantIds));

  if (variants.length === 0) return false;

  // Set active = true
  await pgDb.update(schema.productVariants)
    .set({ active: true })
    .where(inArray(schema.productVariants.id, variantIds));

  const restoredSkus = variants.map((v: any) => v.sku);

  // Log bulk audit log
  await logAudit(
    userId,
    'BULK_RESTORE_SKU',
    'CATALOG',
    `Bulk restored ${variants.length} SKUs: ${restoredSkus.join(', ')}`
  );

  return true;
}

// -----------------------------------------------------------------------------
// APPROVAL POLICY ENGINE
// -----------------------------------------------------------------------------

// Fetch all approval policies
export async function getApprovalPolicies(): Promise<ApprovalPolicy[]> {
  const res = await pgDb.select().from(schema.approvalPolicies).orderBy(schema.approvalPolicies.transactionKey);
  return res.map((p: any) => ({
    id: p.id,
    transactionKey: p.transactionKey,
    displayName: p.displayName,
    approvalMode: p.approvalMode as 'AUTO' | 'MANUAL' | 'THRESHOLD',
    thresholdQuantity: p.thresholdQuantity || 0,
    updatedBy: p.updatedBy || undefined,
    updatedAt: p.updatedAt?.toISOString() || undefined,
    createdAt: p.createdAt.toISOString()
  }));
}

// Fetch a single approval policy by transaction key
export async function getApprovalPolicy(transactionKey: string): Promise<ApprovalPolicy | null> {
  const res = await pgDb.select().from(schema.approvalPolicies)
    .where(eq(schema.approvalPolicies.transactionKey, transactionKey)).limit(1);
  if (res.length === 0) return null;
  const p = res[0];
  return {
    id: p.id,
    transactionKey: p.transactionKey,
    displayName: p.displayName,
    approvalMode: p.approvalMode as 'AUTO' | 'MANUAL' | 'THRESHOLD',
    thresholdQuantity: p.thresholdQuantity || 0,
    updatedBy: p.updatedBy || undefined,
    updatedAt: p.updatedAt?.toISOString() || undefined,
    createdAt: p.createdAt.toISOString()
  };
}

// Update an approval policy
export async function updateApprovalPolicy(
  policyId: string,
  data: {
    approvalMode: 'AUTO' | 'MANUAL' | 'THRESHOLD';
    thresholdQuantity: number;
  },
  userId: string
): Promise<{ success: boolean; error?: string; policy?: ApprovalPolicy }> {
  const existing = await pgDb.select().from(schema.approvalPolicies)
    .where(eq(schema.approvalPolicies.id, policyId)).limit(1);
  if (existing.length === 0) return { success: false, error: 'Approval policy not found.' };

  const policy = existing[0];

  try {
    const updatedRes = await pgDb.update(schema.approvalPolicies).set({
      approvalMode: data.approvalMode,
      thresholdQuantity: data.thresholdQuantity,
      updatedBy: userId,
      updatedAt: new Date()
    }).where(eq(schema.approvalPolicies.id, policyId)).returning();

    const p = updatedRes[0];

    await logAudit(
      userId,
      'POLICY_UPDATE',
      'INVENTORY',
      `Updated approval policy for "${policy.displayName}": mode=${data.approvalMode}, threshold=${data.approvalMode === 'THRESHOLD' ? data.thresholdQuantity : 'disabled'}`
    );

    return {
      success: true,
      policy: {
        id: p.id,
        transactionKey: p.transactionKey,
        displayName: p.displayName,
        approvalMode: p.approvalMode as 'AUTO' | 'MANUAL' | 'THRESHOLD',
        thresholdQuantity: p.thresholdQuantity || 0,
        updatedBy: p.updatedBy || undefined,
        updatedAt: p.updatedAt?.toISOString() || undefined,
        createdAt: p.createdAt.toISOString()
      }
    };
  } catch (err: any) {
    return handleDatabaseError(err, 'updateApprovalPolicy');
  }
}

// Check if a transaction type should be auto-approved
export async function checkAutoApproval(requestType: string, quantity: number): Promise<boolean> {
  const policy = await getApprovalPolicy(requestType);
  if (!policy) return false;

  if (policy.approvalMode === 'AUTO') {
    return true;
  }

  if (policy.approvalMode === 'THRESHOLD') {
    return quantity <= policy.thresholdQuantity;
  }

  return false;
}

// Bulk review (approve/reject) multiple stock requests
export async function bulkReviewStockRequests(
  requestIds: string[],
  status: 'APPROVED' | 'REJECTED',
  userId: string
): Promise<{ success: boolean; successCount: number; failedCount: number; errors: string[] }> {
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const reqId of requestIds) {
    const result = await reviewStockRequest(reqId, status, userId, 'BULK');
    if (result.success) {
      successCount++;
    } else {
      failedCount++;
      errors.push(`Request ${reqId.slice(0, 8)}...: ${result.error}`);
    }
  }

  await logAudit(
    userId,
    status === 'APPROVED' ? 'BULK_APPROVE' : 'BULK_REJECT',
    'INVENTORY',
    `Bulk ${status.toLowerCase()} ${successCount} requests (${failedCount} failed) out of ${requestIds.length} selected`
  );

  return { success: successCount > 0, successCount, failedCount, errors };
}

// Approve all pending requests inside a database transaction
export async function approveAllPendingRequests(
  userId: string
): Promise<{ success: boolean; successCount: number; failedCount: number; errors: string[] }> {
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  try {
    await pgDb.transaction(async (tx: any) => {
      const pendings = await tx.select().from(schema.stockRequests)
        .where(inArray(schema.stockRequests.status, ['PENDING' as any, 'PENDING_RATE_APPROVAL' as any]));

      if (pendings.length === 0) return;

      const allTxRes = await tx.select().from(schema.stockTransactions);
      const transactions = allTxRes.map((t: any) => ({
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

      const localStockCache: Record<string, number> = {};
      const getCachedReadyStock = (variantId: string) => {
        if (localStockCache[variantId] === undefined) {
          const comp = compileStockForVariant(variantId, transactions);
          localStockCache[variantId] = comp.readyStock;
        }
        return localStockCache[variantId];
      };

      for (const req of pendings) {
        const qty = Number(req.quantity);
        const outTypes = ['SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_OUT'];

        if (outTypes.includes(req.requestType as any)) {
          const readyStock = getCachedReadyStock(req.variantId);
          if (readyStock < qty) {
            failedCount++;
            errors.push(`Request ${req.id.slice(0, 8)}...: Insufficient stock (Needed ${qty}, available ${readyStock})`);
            continue;
          }
          localStockCache[req.variantId] -= qty;
        }

        // Valid request: post transaction
        await tx.insert(schema.stockTransactions).values({
          requestId: req.id,
          variantId: req.variantId,
          transactionType: req.requestType as any,
          quantity: qty,
          referenceNumber: req.referenceNumber || null,
          invoiceNumber: req.invoiceNumber || null,
          remarks: req.remarks || null,
          createdBy: req.createdBy
        });

        const isRateChange = req.status === 'PENDING_RATE_APPROVAL';

        // Update request status
        await tx.update(schema.stockRequests).set({
          status: 'APPROVED' as any,
          priceChangeStatus: isRateChange ? 'APPROVED' : null,
          approvalMethod: 'BULK',
          reviewedBy: userId,
          reviewedAt: new Date(),
          approvedBy: userId,
          approvedAt: new Date()
        }).where(eq(schema.stockRequests.id, req.id));

        const profile = await getProfileById(userId);
        const username = profile ? profile.fullName : 'System';

        const skuRes = await tx.select({ sku: schema.productVariants.sku })
          .from(schema.productVariants)
          .where(eq(schema.productVariants.id, req.variantId)).limit(1);
        const skuStr = skuRes[0]?.sku || 'Unknown SKU';

        const auditDesc = `Entity: stock_requests | Entity ID: ${req.id} | Username: ${username} | Description: Bulk-approved ${req.requestType} request for ${req.quantity} units of SKU "${skuStr}" via Approve All`;

        await tx.insert(schema.auditLogs).values({
          userId: userId.startsWith('usr-') ? null : userId,
          action: 'BULK_APPROVED',
          module: 'INVENTORY',
          description: auditDesc
        });

        successCount++;
      }
    });

    return { success: successCount > 0, successCount, failedCount, errors };
  } catch (err: any) {
    console.error('Approve all pending transaction failed:', err.message);
    return { success: false, successCount: 0, failedCount: 0, errors: [err.message || 'Transaction aborted'] };
  }
}


function handleDatabaseError(err: any, contextAction: string): { success: false; error: string } {
  // 1. Log the actual raw PostgreSQL error to developer console.error for tracing
  console.error(`ACTUAL POSTGRESQL ERROR [during ${contextAction}]:`, {
    message: err.message,
    code: err.code,
    detail: err.detail,
    table: err.table,
    column: err.column,
    constraint: err.constraint,
    stack: err.stack
  });

  // 2. Parse and build user-friendly error without any raw SQL
  const code = err.code || (err.cause && (err.cause as any).code) || '';
  const detail = err.detail || (err.cause && (err.cause as any).detail) || '';
  const constraint = err.constraint || (err.cause && (err.cause as any).constraint) || '';
  const table = err.table || (err.cause && (err.cause as any).table) || '';
  const column = err.column || (err.cause && (err.cause as any).column) || '';

  let raw = '';
  if (err.message_primary) {
    raw = err.message_primary;
  } else if (err.cause && (err.cause as any).message_primary) {
    raw = (err.cause as any).message_primary;
  } else if (err.cause && (err.cause as any).message) {
    raw = (err.cause as any).message;
  } else if (err.message) {
    raw = err.message;
  } else {
    raw = String(err);
  }

  // Clean raw from SQL queries/Failed query wrapper
  if (raw.includes('Failed query:') || raw.includes('insert into') || raw.includes('select') || raw.includes('update') || raw.includes('delete')) {
    if (code) {
      if (code === '23503') {
        raw = `insert or update on table "${table || 'unknown'}" violates foreign key constraint "${constraint || 'unknown'}"`;
      } else if (code === '23505') {
        raw = `duplicate key value violates unique constraint "${constraint || 'unknown'}"`;
      } else if (code === '23502') {
        raw = `null value in column "${column || 'unknown'}" violates not-null constraint`;
      } else if (code === '23514') {
        raw = `new row for relation "${table || 'unknown'}" violates check constraint "${constraint || 'unknown'}"`;
      } else if (code === '42P01') {
        raw = `relation "${table || 'unknown'}" does not exist`;
      } else if (code === '42703') {
        raw = `column "${column || 'unknown'}" of relation "${table || 'unknown'}" does not exist`;
      } else if (code === '22P02') {
        raw = `invalid input value for enum or type`;
      }
    } else {
      if (raw.includes('does not exist')) {
        if (raw.includes('relation') || raw.includes('table')) {
          raw = 'relation "stock_requests" does not exist';
        } else if (raw.includes('column')) {
          raw = 'column "reviewed_by" does not exist';
        }
      } else if (raw.includes('violates foreign key')) {
        raw = 'insert or update on table violates foreign key constraint';
      } else if (raw.includes('violates not-null')) {
        raw = 'null value violates not-null constraint';
      } else if (raw.includes('violates check constraint') || raw.includes('violates constraint')) {
        raw = 'new row violates check constraint';
      } else if (raw.includes('invalid input value for enum') || raw.includes('invalid input syntax for type')) {
        raw = 'invalid input value for enum';
      } else {
        raw = `Database operation failed during ${contextAction}.`;
      }
    }
  }

  let userFriendly = '';
  if (code === '42P01' || raw.includes('relation') && raw.includes('does not exist')) {
    userFriendly = `Database Error: Table relation "${table || 'stock_requests'}" does not exist in the database. Please run the database setup migrations.`;
  } else if (code === '42703' || raw.includes('column') && raw.includes('does not exist')) {
    userFriendly = `Database Error: Column "${column || 'unknown'}" does not exist in database table "${table || 'unknown'}".`;
  } else if (code === '23503' || raw.includes('foreign key')) {
    if (constraint.includes('created_by') || raw.includes('created_by') || detail.includes('created_by')) {
      userFriendly = 'Submission Failed: The active user session has an invalid profile UUID. Please re-authenticate.';
    } else if (constraint.includes('variant_id') || raw.includes('variant_id') || detail.includes('variant_id')) {
      userFriendly = 'Submission Failed: The selected knitwear garment SKU variant does not exist in the database.';
    } else {
      userFriendly = `Submission Failed: A referenced record was not found in the database. (Detail: ${detail || raw})`;
    }
  } else if (code === '23502' || raw.includes('null value')) {
    userFriendly = `Validation Failed: A required field (${column || 'unknown'}) was not provided or contains a null value.`;
  } else if (code === '23514' || raw.includes('check constraint')) {
    if (constraint.includes('check_sale_invoice') || raw.includes('check_sale_invoice')) {
      userFriendly = 'Validation Failed: An invoice number is strictly required for wholesale SALE transactions (minimum 3 characters).';
    } else if (constraint.includes('quantity') || raw.includes('quantity')) {
      userFriendly = 'Validation Failed: Quantity must be a positive integer greater than zero.';
    } else {
      userFriendly = `Validation Failed: The data violates a database constraint. (${constraint || raw})`;
    }
  } else if (code === '22P02' || raw.includes('invalid input value for enum') || raw.includes('invalid input syntax for type')) {
    userFriendly = 'Validation Failed: One or more fields contain an invalid selection or enum value.';
  } else {
    userFriendly = `Database Error: ${raw}`;
  }

  return {
    success: false,
    error: userFriendly
  };
}
