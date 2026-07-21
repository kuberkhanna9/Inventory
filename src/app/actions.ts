'use server';

import { 
  createProduct, 
  createVariant, 
  createStockRequest, 
  reviewStockRequest,
  updateVariantPricing, 
  logAudit,
  deleteVariant,
  bulkDeleteVariants,
  restoreVariant,
  bulkRestoreVariants,
  updateApprovalPolicy,
  bulkReviewStockRequests,
  getStockRequests,
  approveAllPendingRequests,
  getProducts
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
    const variant = await createVariant({
      ...parsed.data,
      sku: parsed.data.sku || `SKU-${Date.now()}`
    });
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

    // Check if the request was auto-approved by the policy engine
    if (result.autoApproved) {
      revalidatePath('/');
      revalidatePath('/inventory');
      revalidatePath('/requests');
      return { success: true, message: 'Stock request auto-approved per policy and posted to the immutable ledger!' };
    }

    // If SuperAdmin creates a request and it wasn't auto-approved, manually approve it
    if (user.role === 'SUPERADMIN' && result.request) {
      await reviewStockRequest(result.request.id, 'APPROVED', user.id, 'MANUAL');
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
  items: { variantId: string; quantity: number; wsp?: number; mrp?: number }[],
  requestType: 'STOCK_IN' | 'SALE' | 'DAMAGE_REPAIRABLE' | 'DAMAGE_NON_REPAIRABLE',
  invoiceNumber?: string,
  referenceNumber?: string,
  remarks?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'INVENTORY')) {
    return { success: false, error: 'Access Denied! Unauthorized department for bulk stock operations.' };
  }

  if (!items || items.length === 0) return { success: false, error: 'No variant SKUs selected!' };
  if (requestType === 'SALE' && !invoiceNumber) {
    return { success: false, error: 'Invoice number is required for wholesale bulk sales!' };
  }

  try {
    let successCount = 0;
    let failedCount = 0;

    for (const item of items) {
      if (item.quantity <= 0) {
        failedCount++;
        continue;
      }

      const data = {
        variantId: item.variantId,
        requestType,
        quantity: item.quantity,
        referenceNumber,
        invoiceNumber,
        remarks: remarks || 'Bulk operations post',
        requestedWsp: item.wsp,
        requestedMrp: item.mrp
      };

      const result = await createStockRequest(data, user.id);
      if (result.success && result.request) {
        // Auto-approve if SuperAdmin
        if (user.role === 'SUPERADMIN' && result.request.status !== 'APPROVED') {
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
        message: `Bulk processing completed! Successfully processed ${successCount} entries. (Failed: ${failedCount})`
      };
    }

    return { 
      success: true, 
      message: `Bulk requests created! Created ${successCount} pending ledger requests for approval.` 
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to process bulk operation' };
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

export async function bulkDeleteVariantsAction(variantIds: string[]): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can bulk delete SKU variants.' };
  }

  try {
    const success = await bulkDeleteVariants(variantIds, user.id);
    if (!success) {
      return { success: false, error: 'No SKU variants found to delete.' };
    }
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    return { success: true, message: `Successfully soft-deleted ${variantIds.length} SKU variants.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to bulk delete SKUs' };
  }
}

export async function restoreVariantAction(variantId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can restore SKU variants.' };
  }

  try {
    const success = await restoreVariant(variantId, user.id);
    if (!success) {
      return { success: false, error: 'SKU variant not found.' };
    }
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    return { success: true, message: 'SKU variant restored successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to restore SKU' };
  }
}

export async function bulkRestoreVariantsAction(variantIds: string[]): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can bulk restore SKU variants.' };
  }

  try {
    const success = await bulkRestoreVariants(variantIds, user.id);
    if (!success) {
      return { success: false, error: 'No SKU variants found to restore.' };
    }
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    return { success: true, message: `Successfully restored ${variantIds.length} SKU variants.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to bulk restore SKUs' };
  }
}

// -----------------------------------------------------------------------------
// APPROVAL POLICY MANAGEMENT
// -----------------------------------------------------------------------------
export async function updateApprovalPolicyAction(
  policyId: string,
  data: { approvalMode: 'AUTO' | 'MANUAL' | 'THRESHOLD'; thresholdQuantity: number }
): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can configure approval policies.' };
  }

  try {
    const result = await updateApprovalPolicy(policyId, data, user.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    revalidatePath('/settings');
    return { success: true, message: `Approval policy updated successfully!` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update approval policy' };
  }
}

// -----------------------------------------------------------------------------
// BULK REVIEW (APPROVE / REJECT)
// -----------------------------------------------------------------------------
export async function bulkReviewRequestsAction(
  requestIds: string[],
  status: 'APPROVED' | 'REJECTED'
): Promise<{ success: boolean; error?: string; message?: string; successCount?: number; failedCount?: number }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can bulk approve/reject requests.' };
  }

  if (requestIds.length === 0) {
    return { success: false, error: 'No requests selected.' };
  }

  try {
    const result = await bulkReviewStockRequests(requestIds, status, user.id);
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    revalidatePath('/reports');

    if (result.failedCount > 0) {
      return {
        success: true,
        message: `Bulk ${status.toLowerCase()}: ${result.successCount} succeeded, ${result.failedCount} failed.`,
        successCount: result.successCount,
        failedCount: result.failedCount
      };
    }

    return {
      success: true,
      message: `Successfully ${status.toLowerCase()} ${result.successCount} request${result.successCount > 1 ? 's' : ''}!`,
      successCount: result.successCount,
      failedCount: 0
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Bulk operation failed' };
  }
}

// Approve all pending requests
export async function approveAllPendingAction(): Promise<{ success: boolean; error?: string; message?: string; successCount?: number; failedCount?: number }> {
  const user = await getSession();
  if (!user || user.role !== 'SUPERADMIN') {
    return { success: false, error: 'Access Denied! Only SuperAdmins can approve all requests.' };
  }

  try {
    const result = await approveAllPendingRequests(user.id);
    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/requests');
    revalidatePath('/reports');

    if (result.errors.length > 0 && result.successCount === 0) {
      return {
        success: false,
        error: `Failed to approve requests: ${result.errors.join('; ')}`,
        successCount: 0,
        failedCount: result.failedCount
      };
    }

    let msg = `Successfully approved all ${result.successCount} pending request${result.successCount !== 1 ? 's' : ''}!`;
    if (result.failedCount > 0) {
      msg += ` (${result.failedCount} request(s) skipped due to insufficient stock).`;
    }

    return {
      success: true,
      message: msg,
      successCount: result.successCount,
      failedCount: result.failedCount
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Approve all pending action failed.' };
  }
}

// -----------------------------------------------------------------------------
// EXPORT SELECTED REQUESTS
// -----------------------------------------------------------------------------
export async function exportSelectedRequestsAction(
  requestIds: string[]
): Promise<{ success: boolean; error?: string; data?: any[] }> {
  const user = await getSession();
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'ACCOUNTS')) {
    return { success: false, error: 'Access Denied! Insufficient permissions for export.' };
  }

  if (requestIds.length === 0) {
    return { success: false, error: 'No requests selected.' };
  }

  try {
    const allRequests = await getStockRequests();
    const selectedRequests = allRequests.filter(r => requestIds.includes(r.id));

    const exportData = selectedRequests.map(r => ({
      requestId: r.id,
      transactionType: r.requestType,
      quantity: r.quantity,
      status: r.status,
      approvalMethod: r.approvalMethod || 'N/A',
      referenceNumber: r.referenceNumber || 'N/A',
      invoiceNumber: r.invoiceNumber || 'N/A',
      remarks: r.remarks || '',
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt || 'N/A'
    }));

    await logAudit(
      user.id,
      'EXPORT_REQUESTS',
      'STOCK_REQUESTS',
      `Exported ${selectedRequests.length} stock requests`
    );

    return { success: true, data: exportData };
  } catch (err: any) {
    return { success: false, error: err.message || 'Export failed' };
  }
}
