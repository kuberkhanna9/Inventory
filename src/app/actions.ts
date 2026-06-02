'use server';

import { 
  createProduct, 
  createVariant, 
  createStockRequest, 
  reviewStockRequest,
  updateVariantPricing, 
  logAudit,
  deleteVariant
} from '@/utils/db';
import { getSession, authenticateUser, clearSession } from '@/utils/session';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Zod schemas for input validation
const ProductSchema = z.object({
  productName: z.string().min(2, 'Product name must be at least 2 characters'),
  category: z.string().min(2, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  season: z.string().optional(),
});

const VariantSchema = z.object({
  productId: z.string().min(1, 'Product style selection is required'),
  sku: z.string().optional(),
  barcode: z.string().min(3, 'Barcode must be at least 3 characters'),
  colorName: z.string().min(1, 'Color is required'),
  sizeName: z.string().min(1, 'Size is required'),
  rackLocation: z.string().optional(),
  costPrice: z.number().positive('Cost price must be positive'),
  wholesalePrice: z.number().positive('Wholesale price must be positive'),
  mrp: z.number().positive('MRP must be positive'),
});

const RequestSchema = z.object({
  variantId: z.string().min(1, 'SKU selection is required'),
  requestType: z.enum([
    'STOCK_IN',
    'SALE',
    'DAMAGE_REPAIRABLE',
    'DAMAGE_NON_REPAIRABLE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT'
  ]),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  referenceNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  remarks: z.string().optional(),
});

const PricingSchema = z.object({
  variantId: z.string().min(1),
  costPrice: z.number().positive('Cost price must be positive'),
  wholesalePrice: z.number().positive('Wholesale price must be positive'),
  mrp: z.number().positive('MRP must be positive'),
});

export async function loginAction(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
  const username = (formData.get('username') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();

  if (!username || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  const session = await authenticateUser(username, password);
  if (!session) {
    return { success: false, error: 'Invalid username or password.' };
  }

  return { success: true, message: 'Login successful!' };
}

export async function logoutAction() {
  await clearSession();
  revalidatePath('/');
}

export async function createProductAction(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string; data?: any }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access denied! Only SuperAdmin accounts can register styles.' };
  }

  const rawData = {
    productName: formData.get('productName') as string,
    category: formData.get('category') as string,
    subcategory: formData.get('subcategory') as string || undefined,
    description: formData.get('description') as string || undefined,
    brand: formData.get('brand') as string || undefined,
    season: formData.get('season') as string || undefined,
  };

  const parsed = ProductSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const product = await createProduct(parsed.data);
    revalidatePath('/');
    revalidatePath('/inventory');
    return { success: true, message: `Product style "${product.productName}" created successfully!`, data: product };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create product' };
  }
}

export async function createVariantAction(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string; data?: any }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access denied! Only SuperAdmin accounts can register SKUs.' };
  }

  let sku = (formData.get('sku') as string || '').toUpperCase().trim();
  const colorName = formData.get('colorName') as string;
  const sizeName = formData.get('sizeName') as string;
  const productId = formData.get('productId') as string;

  if (!sku && productId) {
    const products = await getProducts();
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const styleSlug = prod.productName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const colorSlug = colorName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const sizeSlug = sizeName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      let finalSize = sizeSlug;
      if (finalSize === 'FREESIZE') finalSize = 'FS';
      sku = `${styleSlug}-${colorSlug}-${finalSize}`;
    }
  }

  const rawData = {
    productId,
    sku,
    barcode: (formData.get('barcode') as string || '').trim(),
    colorName,
    sizeName,
    rackLocation: formData.get('rackLocation') as string || undefined,
    costPrice: Number(formData.get('costPrice')),
    wholesalePrice: Number(formData.get('wholesalePrice')),
    mrp: Number(formData.get('mrp')),
  };

  const parsed = VariantSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const variant = await createVariant(parsed.data);
    revalidatePath('/');
    revalidatePath('/inventory');
    return { success: true, message: `SKU "${variant.sku}" created successfully!`, data: variant };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create SKU' };
  }
}

export async function createStockRequestAction(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string; data?: any }> {
  const user = await getSession();
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'INVENTORY')) {
    return { success: false, error: 'Access Denied! Only Inventory Dept or SuperAdmin can request stock operations.' };
  }

  const requestType = formData.get('requestType') as any;
  const invoiceNumber = formData.get('invoiceNumber') as string || undefined;

  // Invoice Number is required for SALE dispatches
  if (requestType === 'SALE' && !invoiceNumber) {
    return { success: false, error: 'Invoice number is required for sales dispatches!' };
  }

  const rawData = {
    variantId: formData.get('variantId') as string,
    requestType,
    quantity: Number(formData.get('quantity')),
    referenceNumber: formData.get('referenceNumber') as string || undefined,
    invoiceNumber,
    remarks: formData.get('remarks') as string || undefined,
  };

  const parsed = RequestSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await createStockRequest(parsed.data, user.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Auto-approve if created directly by SuperAdmin!
    if (user.role === 'SUPERADMIN' && result.request) {
      await reviewStockRequest(result.request.id, 'APPROVED', user.id);
      revalidatePath('/');
      revalidatePath('/inventory');
      revalidatePath('/requests');
      return { success: true, message: 'Stock request approved and posted to the immutable ledger instantly!' };
    }

    revalidatePath('/');
    revalidatePath('/requests');
    return { success: true, message: 'Stock request successfully submitted! Pending SuperAdmin approval.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create stock request' };
  }
}

export async function reviewStockRequestAction(requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can approve/reject stock ledger requests.' };
  }

  try {
    const result = await reviewStockRequest(requestId, status, user.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    revalidatePath('/reports');
    return { success: true, message: `Request successfully ${status.toLowerCase()}!` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to review request' };
  }
}

export async function updatePricingAction(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string; data?: any }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can adjust pricing tables.' };
  }

  const rawData = {
    variantId: formData.get('variantId') as string,
    costPrice: Number(formData.get('costPrice')),
    wholesalePrice: Number(formData.get('wholesalePrice')),
    mrp: Number(formData.get('mrp')),
  };

  const parsed = PricingSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const updated = await updateVariantPricing(
      parsed.data.variantId,
      parsed.data.costPrice,
      parsed.data.wholesalePrice,
      parsed.data.mrp,
      user.id
    );
    if (!updated) {
      return { success: false, error: 'SKU variant not found.' };
    }
    revalidatePath('/');
    revalidatePath('/inventory');
    return { success: true, message: 'Pricing updated successfully!' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update pricing' };
  }
}

// -----------------------------------------------------------------------------
// BULK OPERATIONS ENGINE
// -----------------------------------------------------------------------------
export async function bulkOperationsAction(
  variantIds: string[],
  requestType: 'STOCK_IN' | 'SALE' | 'DAMAGE_REPAIRABLE' | 'DAMAGE_NON_REPAIRABLE',
  quantity: number,
  invoiceNumber?: string,
  referenceNumber?: string,
  remarks?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'INVENTORY')) {
    return { success: false, error: 'Access Denied! Unauthorized department for bulk stock operations.' };
  }

  if (variantIds.length === 0) return { success: false, error: 'No variant SKUs selected!' };
  if (quantity <= 0) return { success: false, error: 'Quantity must be positive!' };
  if (requestType === 'SALE' && !invoiceNumber) {
    return { success: false, error: 'Invoice number is required for wholesale bulk sales!' };
  }

  try {
    let successCount = 0;
    let failedCount = 0;

    for (const vId of variantIds) {
      const data = {
        variantId: vId,
        requestType,
        quantity,
        referenceNumber,
        invoiceNumber,
        remarks: remarks || 'Bulk operations post'
      };

      const result = await createStockRequest(data, user.id);
      if (result.success && result.request) {
        // Auto-approve if SuperAdmin
        if (user.role === 'SUPERADMIN') {
          const reviewRes = await reviewStockRequest(result.request.id, 'APPROVED', user.id);
          if (reviewRes.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } else {
          successCount++;
        }
      } else {
        failedCount++;
      }
    }

    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');

    if (user.role === 'SUPERADMIN') {
      return { 
        success: true, 
        message: `Bulk processing completed! Successfully approved & posted ${successCount} entries. (Failed: ${failedCount})`
      };
    }

    return { 
      success: true, 
      message: `Bulk requests created! Created ${successCount} pending ledger requests for approval.` 
    };

  } catch (err: any) {
    return { success: false, error: err.message || 'Bulk operation failed' };
  }
}

export async function deleteVariantAction(variantId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can delete SKU variants.' };
  }

  try {
    const success = await deleteVariant(variantId, user.id);
    if (!success) {
      return { success: false, error: 'SKU variant not found.' };
    }
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    return { success: true, message: 'SKU variant and all associated records permanently soft deleted successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete SKU' };
  }
}

