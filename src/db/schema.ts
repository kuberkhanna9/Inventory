import { pgTable, uuid, varchar, boolean, timestamp, integer, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define Enums
export const roleEnum = pgEnum('user_role', ['SUPERADMIN', 'ACCOUNTS', 'INVENTORY', 'RETAIL']);
export const requestTypeEnum = pgEnum('request_type', [
  'STOCK_IN',
  'SALE',
  'DAMAGE_REPAIRABLE',
  'DAMAGE_NON_REPAIRABLE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT'
]);
export const requestStatusEnum = pgEnum('request_status', ['PENDING', 'APPROVED', 'REJECTED']);

// 1. PROFILES Table
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // maps to auth.users.id
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: roleEnum('role').default('RETAIL').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. PRODUCTS Table
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  subcategory: varchar('subcategory', { length: 100 }),
  description: varchar('description', { length: 1000 }),
  brand: varchar('brand', { length: 100 }),
  season: varchar('season', { length: 50 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. PRODUCT_COLORS Table
export const productColors = pgTable('product_colors', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  colorName: varchar('color_name', { length: 100 }).notNull(),
});

// 4. PRODUCT_SIZES Table
export const productSizes = pgTable('product_sizes', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  sizeName: varchar('size_name', { length: 50 }).notNull(),
});

// 5. PRODUCT_VARIANTS Table (SKUs)
export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  sku: varchar('sku', { length: 100 }).unique().notNull(),
  colorId: uuid('color_id').references(() => productColors.id, { onDelete: 'restrict' }).notNull(),
  sizeId: uuid('size_id').references(() => productSizes.id, { onDelete: 'restrict' }).notNull(),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).notNull(),
  wholesalePrice: numeric('wholesale_price', { precision: 12, scale: 2 }).notNull(),
  mrp: numeric('mrp', { precision: 12, scale: 2 }).notNull(),
  rackLocation: varchar('rack_location', { length: 50 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. STOCK_REQUESTS Table
export const stockRequests = pgTable('stock_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'restrict' }).notNull(),
  requestType: requestTypeEnum('request_type').notNull(),
  quantity: integer('quantity').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  remarks: varchar('remarks', { length: 500 }),
  createdBy: uuid('created_by').references(() => profiles.id).notNull(),
  status: requestStatusEnum('status').default('PENDING').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. STOCK_TRANSACTIONS Table
export const stockTransactions = pgTable('stock_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: uuid('request_id').references(() => stockRequests.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'restrict' }).notNull(),
  transactionType: requestTypeEnum('transaction_type').notNull(),
  quantity: integer('quantity').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  remarks: varchar('remarks', { length: 500 }),
  createdBy: uuid('created_by').references(() => profiles.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. PRICE_HISTORY Table
export const priceHistory = pgTable('price_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
  oldCostPrice: numeric('old_cost_price', { precision: 12, scale: 2 }).notNull(),
  newCostPrice: numeric('new_cost_price', { precision: 12, scale: 2 }).notNull(),
  oldWholesalePrice: numeric('old_wholesale_price', { precision: 12, scale: 2 }).notNull(),
  newWholesalePrice: numeric('new_wholesale_price', { precision: 12, scale: 2 }).notNull(),
  oldMrp: numeric('old_mrp', { precision: 12, scale: 2 }).notNull(),
  newMrp: numeric('new_mrp', { precision: 12, scale: 2 }).notNull(),
  changedBy: uuid('changed_by').references(() => profiles.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. AUDIT_LOGS Table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 255 }).notNull(),
  module: varchar('module', { length: 100 }).notNull(),
  description: varchar('description', { length: 1000 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations setup for Drizzle
export const profilesRelations = relations(profiles, ({ many }) => ({
  requests: many(stockRequests),
  transactions: many(stockTransactions),
  auditLogs: many(auditLogs),
}));

export const productsRelations = relations(products, ({ many }) => ({
  colors: many(productColors),
  sizes: many(productSizes),
  variants: many(productVariants),
}));

export const productColorsRelations = relations(productColors, ({ one, many }) => ({
  product: one(products, {
    fields: [productColors.productId],
    references: [products.id],
  }),
  variants: many(productVariants),
}));

export const productSizesRelations = relations(productSizes, ({ one, many }) => ({
  product: one(products, {
    fields: [productSizes.productId],
    references: [products.id],
  }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  color: one(productColors, {
    fields: [productVariants.colorId],
    references: [productColors.id],
  }),
  size: one(productSizes, {
    fields: [productVariants.sizeId],
    references: [productSizes.id],
  }),
  requests: many(stockRequests),
  transactions: many(stockTransactions),
  priceHistories: many(priceHistory),
}));
