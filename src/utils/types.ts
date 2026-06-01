export interface Profile {
  id: string;
  fullName: string;
  role: 'SUPERADMIN' | 'ACCOUNTS' | 'INVENTORY' | 'RETAIL';
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  productName: string;
  category: string;
  subcategory?: string;
  description?: string;
  brand?: string;
  season?: string;
  active: boolean;
  createdAt: string;
}

export interface ProductColor {
  id: string;
  productId: string;
  colorName: string;
}

export interface ProductSize {
  id: string;
  productId: string;
  sizeName: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  colorId: string; // references ProductColor.id
  sizeId: string;  // references ProductSize.id
  costPrice: number;
  wholesalePrice: number;
  mrp: number;
  rackLocation?: string;
  active: boolean;
  createdAt: string;
}

export interface StockRequest {
  id: string;
  variantId: string;
  requestType: 'STOCK_IN' | 'SALE' | 'DAMAGE_REPAIRABLE' | 'DAMAGE_NON_REPAIRABLE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  referenceNumber?: string;
  invoiceNumber?: string; // required for SALE
  remarks?: string;
  createdBy: string; // references Profile.id
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string; // references Profile.id
  reviewedAt?: string;
  createdAt: string;
}

export interface StockTransaction {
  id: string;
  requestId: string; // references StockRequest.id
  variantId: string;
  transactionType: 'STOCK_IN' | 'SALE' | 'DAMAGE_REPAIRABLE' | 'DAMAGE_NON_REPAIRABLE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  referenceNumber?: string;
  invoiceNumber?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
}

export interface PriceHistory {
  id: string;
  variantId: string;
  oldCostPrice: number;
  newCostPrice: number;
  oldWholesalePrice: number;
  newWholesalePrice: number;
  oldMrp: number;
  newMrp: number;
  changedBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  module: string;
  description: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// DYNAMIC STOCK COMPILATION UTILITY
// -----------------------------------------------------------------------------
export interface ComputedStock {
  readyStock: number;
  repairableStock: number;
  scrapStock: number;
}

export function compileStockForVariant(variantId: string, transactions: StockTransaction[]): ComputedStock {
  let readyStock = 0;
  let repairableStock = 0;
  let scrapStock = 0;

  for (const t of transactions) {
    if (t.variantId !== variantId) continue;
    const qty = Number(t.quantity);
    
    switch (t.transactionType) {
      case 'STOCK_IN':
      case 'ADJUSTMENT_IN':
        readyStock += qty;
        break;
      case 'SALE':
      case 'ADJUSTMENT_OUT':
        readyStock -= qty;
        break;
      case 'DAMAGE_REPAIRABLE':
        readyStock -= qty;
        repairableStock += qty;
        break;
      case 'DAMAGE_NON_REPAIRABLE':
        readyStock -= qty;
        scrapStock += qty;
        break;
    }
  }

  return { readyStock, repairableStock, scrapStock };
}
