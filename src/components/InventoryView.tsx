'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import type { ComputedInventoryItem } from '@/utils/db';
import { Product } from '@/utils/types';
import { 
  createProductAction, 
  createVariantAction, 
  bulkOperationsAction,
  createStockRequestAction,
  updatePricingAction,
  deleteVariantAction
} from '@/app/actions';
import { 
  Search, 
  SlidersHorizontal, 
  Plus, 
  Tag, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Eye,
  FileSpreadsheet,
  Download,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  TrendingUp,
  X,
  History,
  Lock,
  PlusCircle,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Scan,
  Printer,
  Copy,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import BarcodeLabels from './BarcodeLabels';

interface InventoryViewProps {
  userRole: 'SUPERADMIN' | 'ACCOUNTS' | 'INVENTORY' | 'RETAIL';
  inventoryItems: ComputedInventoryItem[];
  products: Product[];
  allTransactions: any[];
  allPriceHistory: any[];
  allRequests: any[];
}

export default function InventoryView({ 
  userRole, 
  inventoryItems, 
  products, 
  allTransactions,
  allPriceHistory,
  allRequests
}: InventoryViewProps) {
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  // Scanning State
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Bulk operation states
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'STOCK_IN' | 'SALE' | 'DAMAGE_REPAIRABLE' | 'DAMAGE_NON_REPAIRABLE'>('STOCK_IN');
  const [bulkQty, setBulkQty] = useState(10);
  const [bulkRef, setBulkRef] = useState('');
  const [bulkInvoice, setBulkInvoice] = useState('');
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [bulkFeedback, setBulkFeedback] = useState<{ success?: boolean; error?: string; message?: string }>({});

  // Label Printing states
  const [isLabelStudioOpen, setIsLabelStudioOpen] = useState(false);

  // Active Variant detail modal
  const [selectedVariant, setSelectedVariant] = useState<ComputedInventoryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Delete SKU states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Close drawer helpers & key listeners
  const handleDrawerBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSelectedVariant(null);
      setIsDrawerOpen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeleteModalOpen) {
          setIsDeleteModalOpen(false);
        } else {
          setSelectedVariant(null);
          setIsDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleteModalOpen]);

  const handleDeleteConfirm = () => {
    if (deleteConfirmInput !== 'DELETE' || !selectedVariant) return;

    startTransition(async () => {
      const res = await deleteVariantAction(selectedVariant.variantId);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setSelectedVariant(null);
        setIsDrawerOpen(false);
        alert(res.message);
      } else {
        alert(res.error || 'Failed to delete SKU variant');
      }
    });
  };

  // Modal display states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  
  // Excel Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'sync' | 'migration'>('sync');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excel2DData, setExcel2DData] = useState<any[][]>([]);
  const [detectedHeaderRow, setDetectedHeaderRow] = useState<number>(1);
  const [headerRowNumber, setHeaderRowNumber] = useState<number>(1);
  
  // Custom column mapping configuration matching the dedicated import template fields
  const [mapping, setMapping] = useState<Record<string, string>>({
    productName: 'Product Name',
    category: 'Category / Type',
    productCode: 'UPC No',
    barcode: 'Barcode (Primary Unique Key)',
    color: 'Color',
    size: 'Size',
    rackLocation: 'Rack Location',
    totalStock: 'Available Quantity',
    costPrice: 'Cost Price',
    wholesalePrice: 'Wholesale Price',
    mrp: 'MRP'
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importFeedback, setImportFeedback] = useState<string>('');
  
  // Migration Report state
  const [migrationReport, setMigrationReport] = useState<{
    totalProductsImported: number;
    totalVariantsImported: number;
    totalInventoryImported: number;
    errors: string[];
    skipped: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const isRetail = userRole === 'RETAIL';
  const isAccounts = userRole === 'ACCOUNTS';
  const isInventory = userRole === 'INVENTORY';
  const isSuperAdmin = userRole === 'SUPERADMIN';

  // Scanner autofocus effect
  useEffect(() => {
    if (scanMode && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [scanMode]);

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Filter compilations
  const categories = Array.from(new Set(inventoryItems.map(item => item.category)));
  const colors = Array.from(new Set(inventoryItems.map(item => item.colorName)));
  const sizes = Array.from(new Set(inventoryItems.map(item => item.sizeName)));

  // Universal fast search: prioritizing exact Barcode, then fallback to SKU, product name, color, and size
  const filteredItems = inventoryItems.filter(item => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      const matchesProduct = selectedProduct === '' || item.productId === selectedProduct;
      const matchesCategory = selectedCategory === '' || item.category === selectedCategory;
      const matchesColor = selectedColor === '' || item.colorName === selectedColor;
      const matchesSize = selectedSize === '' || item.sizeName === selectedSize;
      return matchesProduct && matchesCategory && matchesColor && matchesSize;
    }

    // Exact matches first (Barcode and SKU are checked explicitly)
    const barcodeMatch = item.barcode.toLowerCase() === term;
    const skuMatch = item.sku.toLowerCase() === term;
    
    // Fuzzy searches
    const nameMatch = item.productName.toLowerCase().includes(term);
    const colorMatch = item.colorName.toLowerCase().includes(term);
    const sizeMatch = item.sizeName.toLowerCase().includes(term);
    const rackMatch = item.rackLocation && item.rackLocation.toLowerCase().includes(term);

    const matchesFilters = 
      (selectedProduct === '' || item.productId === selectedProduct) &&
      (selectedCategory === '' || item.category === selectedCategory) &&
      (selectedColor === '' || item.colorName === selectedColor) &&
      (selectedSize === '' || item.sizeName === selectedSize);

    return (barcodeMatch || skuMatch || nameMatch || colorMatch || sizeMatch || rackMatch) && matchesFilters;
  });

  // Handle scanned barcode lookups
  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = scanInput.trim();
    if (!barcode) return;

    // Fast priority barcode matching
    const item = inventoryItems.find(v => v.barcode === barcode || v.sku.toUpperCase() === barcode.toUpperCase());
    if (item) {
      setSelectedVariant(item);
      setIsDrawerOpen(true);
      setScanInput('');
      setScanMode(false);
    } else {
      alert(`No variant registered with barcode/SKU: "${barcode}"`);
    }
  };

  // -----------------------------------------------------------------------------
  // BULK SUBMIT PROCESSOR
  // -----------------------------------------------------------------------------
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBulkFeedback({});
    startTransition(async () => {
      const res = await bulkOperationsAction(
        selectedVariantIds,
        bulkAction,
        bulkQty,
        bulkInvoice || undefined,
        bulkRef || undefined,
        bulkRemarks || undefined
      );
      setBulkFeedback(res);
      if (res.success) {
        setSelectedVariantIds([]);
        setTimeout(() => {
          setIsBulkOpen(false);
          setBulkFeedback({});
        }, 2000);
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedVariantIds.length === filteredItems.length) {
      setSelectedVariantIds([]);
    } else {
      setSelectedVariantIds(filteredItems.map(item => item.variantId));
    }
  };

  const toggleSelectVariant = (id: string) => {
    if (selectedVariantIds.includes(id)) {
      setSelectedVariantIds(selectedVariantIds.filter(vId => vId !== id));
    } else {
      setSelectedVariantIds([...selectedVariantIds, id]);
    }
  };

  // -----------------------------------------------------------------------------
  // EXCEL EXPORT - Closely resembling "FG STOCK 2025-26.xlsx" format with customer dispatches
  // -----------------------------------------------------------------------------
  // -----------------------------------------------------------------------------
  // DOWNLOAD CLEAN INVENTORY IMPORT TEMPLATE (.xlsx)
  // -----------------------------------------------------------------------------
  const downloadCleanTemplate = () => {
    const templateData = [
      {
        'Product Name': 'Heritage Poncho',
        'Category / Type': 'Ponchos',
        'UPC No': 'HS-PONCHO',
        'Barcode (Primary Unique Key)': '110000000001',
        'Color': 'Beige',
        'Size': 'Free Size',
        'Rack Location': 'A-03',
        'Available Quantity': 50,
        'Cost Price': 1650,
        'Wholesale Price': 2850,
        'MRP': 4995
      },
      {
        'Product Name': 'Merino Wool Cape',
        'Category / Type': 'Capes',
        'UPC No': 'LJK-CAPE',
        'Barcode (Primary Unique Key)': '110000000003',
        'Color': 'Crimson Red',
        'Size': 'M',
        'Rack Location': 'B-01',
        'Available Quantity': 25,
        'Cost Price': 2200,
        'Wholesale Price': 3800,
        'MRP': 6495
      },
      {
        'Product Name': 'Cable Knit Sweater',
        'Category / Type': 'Sweaters',
        'UPC No': 'LJK-SWEATER',
        'Barcode (Primary Unique Key)': '110000000004',
        'Color': 'Navy Blue',
        'Size': 'L',
        'Rack Location': 'C-02',
        'Available Quantity': 40,
        'Cost Price': 1800,
        'Wholesale Price': 3100,
        'MRP': 5495
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Inventory Template');
    XLSX.writeFile(wb, 'Knitwear_Inventory_Template.xlsx');
  };

  // -----------------------------------------------------------------------------
  // DEDICATED EXCEL IMPORT TEMPLATE PARSER & LOGIC
  // -----------------------------------------------------------------------------
  const processSheetData = (rawRows: any[][], headerRowIndex: number) => {
    if (!rawRows || rawRows.length < headerRowIndex) return;

    // Dedicated template header is always Row 1 (headerRowIndex = 1)
    const headerRow = rawRows[headerRowIndex - 1] || [];
    const headers = headerRow.map((val: any) => String(val || '').trim());
    
    // Ensure all required template headers are present
    const requiredCols = [
      'Product Name',
      'Category / Type',
      'UPC No',
      'Barcode (Primary Unique Key)',
      'Color',
      'Size',
      'Rack Location',
      'Available Quantity',
      'Cost Price',
      'Wholesale Price',
      'MRP'
    ];

    const missingCols = requiredCols.filter(col => !headers.includes(col));
    if (missingCols.length > 0) {
      setValidationErrors([
        `Invalid Template Format! The uploaded worksheet is missing required columns: ${missingCols.join(', ')}. Please use the standard Knitwear Import Template.`
      ]);
      setExcelData([]);
      return;
    }

    setExcelHeaders(headers);

    // Map remaining rows to JSON objects using exact template headers
    const parsedData = rawRows.slice(headerRowIndex).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        obj[h] = row[colIdx];
      });
      return obj;
    });

    setExcelData(parsedData);
    setValidationErrors([]);
    setImportFeedback('');
    setMigrationReport(null);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Parse sheet as 2D array
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        if (rawRows.length === 0) {
          setValidationErrors(['The selected sheet is empty.']);
          return;
        }

        setExcel2DData(rawRows);
        setHeaderRowNumber(1);
        processSheetData(rawRows, 1);

      } catch (err: any) {
        setValidationErrors([`File reading error: ${err.message}`]);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Run validation checks on clean template structure
  const runExcelValidation = () => {
    const errors: string[] = [];
    if (excelData.length === 0) {
      errors.push('No parsed data rows found to validate.');
      setValidationErrors(errors);
      return false;
    }

    const barcodes = new Set<string>();
    excelData.forEach((row, index) => {
      const barcode = String(row['Barcode (Primary Unique Key)'] || '').trim();
      const name = String(row['Product Name'] || '').trim();
      const color = String(row['Color'] || '').trim();
      const size = String(row['Size'] || '').trim();
      const mrp = Number(row['MRP'] || 0);
      const totalStock = Number(row['Available Quantity'] || 0);

      // Barcode validation (Mandatory and Unique inside sheet)
      if (!barcode) {
        errors.push(`Row ${index + 2}: Missing "Barcode (Primary Unique Key)" value.`);
      } else {
        if (barcodes.has(barcode)) {
          errors.push(`Row ${index + 2}: Duplicate barcode "${barcode}" inside workbook.`);
        }
        barcodes.add(barcode);
      }

      if (!name) errors.push(`Row ${index + 2} (${barcode || 'N/A'}): "Product Name" cannot be empty.`);
      if (!color) errors.push(`Row ${index + 2} (${barcode || 'N/A'}): "Color" cannot be empty.`);
      if (!size) errors.push(`Row ${index + 2} (${barcode || 'N/A'}): "Size" cannot be empty.`);
      if (isNaN(mrp) || mrp <= 0) errors.push(`Row ${index + 2} (${barcode || 'N/A'}): Invalid MRP "${row['MRP']}" (Must be a positive number).`);
      if (isNaN(totalStock) || totalStock < 0) errors.push(`Row ${index + 2} (${barcode || 'N/A'}): "Available Quantity" value cannot be negative.`);
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Excel template sync and update commit engine
  const handleImportApply = () => {
    if (!runExcelValidation()) return;

    startTransition(async () => {
      try {
        if (importMode === 'sync') {
          // MODE 2: Ongoing Sync and Discrepancy checks
          let adjustmentRequestsCreated = 0;
          let unchangedItems = 0;

          for (const row of excelData) {
            const barcodeVal = String(row['Barcode (Primary Unique Key)'] || '').trim();
            const targetQty = Number(row['Available Quantity'] || 0);
            
            // Match records by Barcode PUK
            const variant = inventoryItems.find(v => v.barcode === barcodeVal);

            if (!variant) continue;

            const diff = targetQty - variant.readyStock;
            if (diff === 0) {
              unchangedItems++;
              continue;
            }

            // Generate adjustment request
            const adjustmentType = diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
            const qty = Math.abs(diff);

            const fd = new FormData();
            fd.append('variantId', variant.variantId);
            fd.append('requestType', adjustmentType);
            fd.append('quantity', String(qty));
            fd.append('remarks', `Template Ongoing Sync. Target Available Qty: ${targetQty} (System: ${variant.readyStock}, Diff: ${diff > 0 ? '+' : '-'}${qty})`);

            const res = await createStockRequestAction({}, fd);
            if (res.success) {
              adjustmentRequestsCreated++;
            }
          }

          setImportFeedback(`Ongoing Sync completed! Generated ${adjustmentRequestsCreated} stock adjustment requests pending SuperAdmin review. (${unchangedItems} matched perfectly).`);
          setTimeout(() => {
            setIsImportOpen(false);
            setExcelData([]);
            setImportFeedback('');
          }, 4500);

        } else {
          // MODE 1: Initial Migration / Template Import
          let productsImported = 0;
          let variantsImported = 0;
          let variantsUpdated = 0;
          let stockRequestsPosted = 0;
          const importErrors: string[] = [];
          const itemsSkipped: string[] = [];

          for (const row of excelData) {
            const barcodeVal = String(row['Barcode (Primary Unique Key)'] || '').trim();
            const productNameVal = String(row['Product Name'] || '').trim();
            const categoryVal = String(row['Category / Type'] || 'Ponchos').trim();
            const colorVal = String(row['Color'] || 'Free').trim();
            const sizeVal = String(row['Size'] || 'FS').trim();
            const mrpVal = Number(row['MRP'] || 0);
            const rackVal = String(row['Rack Location'] || 'Warehouse').trim();
            const costVal = Number(row['Cost Price'] || Math.round(mrpVal * 0.4));
            const wholesaleVal = Number(row['Wholesale Price'] || Math.round(mrpVal * 0.6));
            const availableQtyVal = Number(row['Available Quantity'] || 0);

            // 1. Check if barcode already exists in DB
            let existingVariant = inventoryItems.find(v => v.barcode === barcodeVal);

            if (existingVariant) {
              // Existing barcodes update records!
              const fd = new FormData();
              fd.append('variantId', existingVariant.variantId);
              fd.append('costPrice', String(costVal));
              fd.append('wholesalePrice', String(wholesaleVal));
              fd.append('mrp', String(mrpVal));
              
              const priceRes = await updatePricingAction({}, fd);
              if (priceRes.success) {
                variantsUpdated++;
              } else {
                importErrors.push(`Failed to update pricing for pre-existing barcode "${barcodeVal}": ${priceRes.error}`);
              }
              
              // Also sync stock differences as approved initial movements
              const diff = availableQtyVal - existingVariant.readyStock;
              if (diff !== 0) {
                const adjFd = new FormData();
                adjFd.append('variantId', existingVariant.variantId);
                adjFd.append('requestType', diff > 0 ? 'STOCK_IN' : 'SALE');
                adjFd.append('quantity', String(Math.abs(diff)));
                adjFd.append('remarks', `Template import stock sync (Target Available: ${availableQtyVal})`);
                if (diff < 0) {
                  adjFd.append('invoiceNumber', `INV-MIG-${barcodeVal.slice(-4)}`);
                }
                
                const stockRes = await createStockRequestAction({}, adjFd);
                if (stockRes.success) stockRequestsPosted++;
              }
              continue;
            }

            // 2. Find or register Parent Product Style
            let parentProduct = products.find(p => p.productName.toLowerCase() === productNameVal.toLowerCase());
            if (!parentProduct) {
              const prodFd = new FormData();
              prodFd.append('productName', productNameVal);
              prodFd.append('category', categoryVal);
              prodFd.append('brand', 'LJK Knitwear');
              prodFd.append('description', 'Imported style template');

              const prodRes = await createProductAction({}, prodFd);
              if (prodRes.success && prodRes.data) {
                parentProduct = prodRes.data;
                productsImported++;
              } else {
                importErrors.push(`Failed to register Product "${productNameVal}": ${prodRes.error}`);
                continue;
              }
            }

            if (!parentProduct) continue;

            // 3. Auto-generate SKU
            const cleanName = parentProduct.productName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
            const cleanColor = colorVal.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
            const cleanSize = sizeVal.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
            const generatedSku = `${cleanName}-${cleanColor}-${cleanSize === 'FREESIZE' ? 'FS' : cleanSize}`;

            // 4. Create Variant with primary barcode identifier
            const variantFd = new FormData();
            variantFd.append('productId', parentProduct.id);
            variantFd.append('sku', generatedSku);
            variantFd.append('barcode', barcodeVal);
            variantFd.append('colorName', colorVal);
            variantFd.append('sizeName', sizeVal);
            variantFd.append('costPrice', String(costVal));
            variantFd.append('wholesalePrice', String(wholesaleVal));
            variantFd.append('mrp', String(mrpVal));
            variantFd.append('rackLocation', rackVal);

            const varRes = await createVariantAction({}, variantFd);
            if (!varRes.success) {
              importErrors.push(`Failed to register Variant "${generatedSku}" (Barcode: ${barcodeVal}): ${varRes.error}`);
              continue;
            }

            variantsImported++;
            const newVar = varRes.data;

            // 5. Post starting available stock
            if (availableQtyVal > 0 && newVar) {
              const reqFd = new FormData();
              reqFd.append('variantId', newVar.id);
              reqFd.append('requestType', 'STOCK_IN');
              reqFd.append('quantity', String(availableQtyVal));
              reqFd.append('remarks', 'Imported available stock');
              reqFd.append('referenceNumber', 'IMPORT-INITIAL');

              const reqRes = await createStockRequestAction({}, reqFd);
              if (reqRes.success) stockRequestsPosted++;
            }
          }

          setMigrationReport({
            totalProductsImported: productsImported,
            totalVariantsImported: variantsImported + variantsUpdated,
            totalInventoryImported: stockRequestsPosted,
            errors: importErrors,
            skipped: itemsSkipped
          });
        }
      } catch (err: any) {
        setValidationErrors([`Initial migration failed: ${err.message}`]);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Printable Area Hook for Barcode labels */}
      <BarcodeLabels
        isOpen={isLabelStudioOpen}
        onClose={() => {
          setIsLabelStudioOpen(false);
          setSelectedVariant(null);
        }}
        selectedVariants={
          selectedVariantIds.length > 0 
            ? inventoryItems.filter(v => selectedVariantIds.includes(v.variantId))
            : selectedVariant ? [selectedVariant] : []
        }
      />

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lall Ji Knitwears Inventory Management System</h1>
          <p className="text-slate-500 text-xs mt-1">Light-mode, barcode-centered finished goods ledger catalog.</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Barcode labels generator trigger */}
          {(selectedVariantIds.length > 0 || selectedVariant) && (
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                setIsLabelStudioOpen(true);
              }}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 no-print"
            >
              <Printer size={14} className="text-slate-800" />
              <span>Print Barcode Labels</span>
            </button>
          )}

          {/* Download Template / Export */}
          <button
            onClick={downloadCleanTemplate}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 no-print"
          >
            <Download size={14} className="text-slate-500" />
            <span>Download Import Template</span>
          </button>

          {/* Excel Import (Inventory Dept and SuperAdmin only) */}
          {(isSuperAdmin || isInventory) && (
            <button
              onClick={() => setIsImportOpen(true)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 no-print"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Import Excel Sync</span>
            </button>
          )}

          {/* SKU registration triggers (SuperAdmin only) */}
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setIsProductModalOpen(true)}
                className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 no-print"
              >
                <Plus size={14} />
                <span>Register Style</span>
              </button>
              <button
                onClick={() => setIsSkuModalOpen(true)}
                className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 no-print"
              >
                <Plus size={14} />
                <span>Register SKU</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Scanning Bar & Filters */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 no-print">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
            <SlidersHorizontal size={14} className="text-slate-600" />
            <span>Search Control Panel</span>
          </div>

          {/* Scan Barcode Toggle Button */}
          <button
            onClick={() => setScanMode(!scanMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              scanMode ? 'bg-amber-500 border-amber-600 text-slate-900 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Scan size={14} />
            <span>{scanMode ? 'Focus Scanner' : 'Simulate Scanner'}</span>
          </button>
        </div>

        {/* Scan Barcode Form */}
        {scanMode && (
          <form onSubmit={handleBarcodeScanSubmit} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
            <Scan size={16} className="text-amber-500 shrink-0" />
            <input
              ref={scanInputRef}
              type="text"
              placeholder="Aim Barcode scanner / type and press Enter..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              type="submit"
              className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-black px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              Enter Scan
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Instant Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-3 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search Barcode PUK, SKU, Product Name, color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 transition-colors font-mono"
            />
          </div>

          {/* Product Style dropdown */}
          <div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
            >
              <option value="">All Styles</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.productName}</option>
              ))}
            </select>
          </div>

          {/* Color dropdown */}
          <div>
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
            >
              <option value="">All Colors</option>
              {colors.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Size dropdown */}
          <div>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
            >
              <option value="">All Sizes</option>
              {sizes.map(sz => (
                <option key={sz} value={sz}>{sz}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedVariantIds.length > 0 && (
        <div className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in shadow-md no-print">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-white" />
            <span className="text-xs font-bold">Selected {selectedVariantIds.length} variant SKUs for bulk action</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setBulkAction('STOCK_IN');
                setIsBulkOpen(true);
              }}
              className="bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Bulk Stock In
            </button>
            <button
              onClick={() => {
                setBulkAction('SALE');
                setIsBulkOpen(true);
              }}
              className="bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Bulk Sale
            </button>
            <button
              onClick={() => {
                setBulkAction('DAMAGE_REPAIRABLE');
                setIsBulkOpen(true);
              }}
              className="bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Bulk Damage
            </button>
            <button
              onClick={() => setSelectedVariantIds([])}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Operational Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm print-area">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4 w-12 text-center no-print">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                    {selectedVariantIds.length === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare size={14} className="text-slate-700" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">Barcode (PUK)</th>
                <th className="px-6 py-4">SKU / Code</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-center">Color</th>
                <th className="px-6 py-4 text-center">Size</th>
                <th className="px-6 py-4 text-center font-black text-slate-900 bg-slate-50/50">Total Ready Stock</th>
                <th className="px-6 py-4 text-center">Repairable</th>
                <th className="px-6 py-4 text-center">Scrap</th>
                {!isRetail && <th className="px-6 py-4 text-right">Cost Price</th>}
                {!isRetail && <th className="px-6 py-4 text-right">Wholesale</th>}
                <th className="px-6 py-4 text-right">MRP</th>
                <th className="px-6 py-4 text-center">Location</th>
                {!isRetail && <th className="px-6 py-4 text-right">Valuation</th>}
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                    No SKU variants registered in operational system catalog.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isSelected = selectedVariantIds.includes(item.variantId);
                  return (
                    <tr 
                      key={item.variantId} 
                      onClick={() => {
                        setSelectedVariant(item);
                        setIsDrawerOpen(true);
                      }}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-slate-50/70' : ''
                      }`}
                    >
                      <td className="px-6 py-3.5 text-center no-print" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleSelectVariant(item.variantId)} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                          {isSelected ? (
                            <CheckSquare size={14} className="text-slate-700" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-xs font-mono font-bold text-slate-600 tracking-wider">
                        <span className="inline-flex items-center gap-1">
                          <Scan size={10} className="text-slate-400" />
                          {item.barcode || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs font-extrabold text-slate-900 font-mono">{item.sku}</td>
                      <td className="px-6 py-3.5 text-xs font-bold text-slate-800">{item.productName}</td>
                      <td className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500">{item.colorName}</td>
                      <td className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500">{item.sizeName}</td>
                      
                      {/* Operational stock counts columns */}
                      <td className="px-6 py-3.5 text-center text-xs font-extrabold text-slate-950 bg-emerald-500/[0.04] border-x border-slate-100">
                        {item.readyStock}
                      </td>
                      <td className="px-6 py-3.5 text-center text-xs font-bold text-amber-600 bg-amber-500/[0.02]">
                        {item.repairableStock}
                      </td>
                      <td className="px-6 py-3.5 text-center text-xs font-bold text-slate-400 bg-slate-500/[0.01]">
                        {item.scrapStock}
                      </td>

                      {/* Valuation filters based on roles */}
                      {!isRetail && (
                        <td className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 font-mono">
                          {formatCurrency(item.costPrice)}
                        </td>
                      )}
                      {!isRetail && (
                        <td className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 font-mono">
                          {formatCurrency(item.wholesalePrice)}
                        </td>
                      )}
                      
                      <td className="px-6 py-3.5 text-right text-xs font-semibold text-slate-800 font-mono">
                        {formatCurrency(item.mrp)}
                      </td>
                      <td className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 font-mono">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} className="text-slate-400" />
                          {item.rackLocation}
                        </span>
                      </td>

                      {!isRetail && (
                        <td className="px-6 py-3.5 text-right text-xs font-extrabold text-slate-900 bg-slate-100/[0.05] font-mono">
                          {formatCurrency(item.inventoryCostValue)}
                        </td>
                      )}

                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          item.status === 'In Stock' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'Low Stock' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -----------------------------------------------------------------------------
          VARIANT DETAIL SIDE MODAL
          ----------------------------------------------------------------------------- */}
      {selectedVariant && isDrawerOpen && (
        <div 
          onClick={handleDrawerBackdropClick}
          className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs no-print"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between animate-slide-in overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
              <div className="space-y-1 bg-transparent">
                <span className="text-[10px] font-black px-2 py-0.5 bg-slate-800 text-white rounded-md uppercase tracking-wider font-mono">
                  {selectedVariant.sku}
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-2">{selectedVariant.productName}</h2>
                <p className="text-slate-500 text-xs">
                  Barcode: <span className="font-mono font-bold text-slate-700">{selectedVariant.barcode}</span> • Col: {selectedVariant.colorName} • Size {selectedVariant.sizeName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsLabelStudioOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs"
                  title="Print Barcode Label"
                >
                  <Printer size={14} className="text-slate-600" />
                  <span>Print Label</span>
                </button>
                <button 
                  onClick={() => {
                    setSelectedVariant(null);
                    setIsDrawerOpen(false);
                  }}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Scan Info Block */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-amber-800">
                <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">Permanent Primary Key Barcode</span>
                  <p className="mt-0.5 text-amber-700">This item uses barcode <span className="font-mono font-extrabold bg-amber-100 px-1 rounded">{selectedVariant.barcode}</span> for scanning. All stock movements must reference this identifier.</p>
                </div>
              </div>

              {/* Ready / Repairable / Scrap stock tallies */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Ready Stock</span>
                  <span className="text-xl font-black text-slate-900 mt-1 block font-mono">{selectedVariant.readyStock} pcs</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Repairable</span>
                  <span className="text-xl font-black text-amber-600 mt-1 block font-mono">{selectedVariant.repairableStock} pcs</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Scrap</span>
                  <span className="text-xl font-black text-slate-400 mt-1 block font-mono">{selectedVariant.scrapStock} pcs</span>
                </div>
              </div>

              {/* Valuation summaries */}
              {!isRetail && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Inventory Value (Cost Base)</span>
                    <span className="text-base font-extrabold block mt-0.5 font-mono">{formatCurrency(selectedVariant.inventoryCostValue)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block">MRP Retail</span>
                    <span className="text-base font-extrabold text-amber-400 block mt-0.5 font-mono">{formatCurrency(selectedVariant.mrp)}</span>
                  </div>
                </div>
              )}

              {/* History Tabs (Ledger and Price Logs) */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <History size={14} className="text-slate-500" />
                  <span>Approved Stock Ledger movements</span>
                </h3>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {allTransactions.filter(t => t.variantId === selectedVariant.variantId).length === 0 ? (
                    <p className="text-slate-400 text-xs py-6 text-center border border-dashed border-slate-200 rounded-xl">No ledger operations approved for this SKU.</p>
                  ) : (
                    allTransactions
                      .filter(t => t.variantId === selectedVariant.variantId)
                      .map((tx: any) => {
                        const isOut = ['SALE', 'DAMAGE_REPAIRABLE', 'DAMAGE_NON_REPAIRABLE', 'ADJUSTMENT_OUT'].includes(tx.transactionType);
                        return (
                          <div key={tx.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-slate-800 uppercase text-[9px]">{tx.transactionType}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Ref: {tx.referenceNumber || 'N/A'} {tx.invoiceNumber ? `• Inv: ${tx.invoiceNumber}` : ''}</span>
                            </div>
                            <div className="text-right">
                              <span className={`font-black ${isOut ? 'text-red-500' : 'text-emerald-600'}`}>
                                {isOut ? '-' : '+'}{tx.quantity}
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">{new Date(tx.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold font-mono">Location: {selectedVariant.rackLocation}</span>
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <button 
                    onClick={() => {
                      setDeleteConfirmInput('');
                      setIsDeleteModalOpen(true);
                    }}
                    className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2 rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    Delete SKU
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedVariant(null);
                    setIsDrawerOpen(false);
                  }}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------------
          BULK OPERATIONS FORM MODAL
          ----------------------------------------------------------------------------- */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Layers size={16} className="text-slate-800" />
                  <span>Execute Bulk Stock Action</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Affects {selectedVariantIds.length} selected SKUs.</p>
              </div>
              <button onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Bulk Action Type</label>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                >
                  <option value="STOCK_IN">STOCK IN (Production completed)</option>
                  <option value="SALE">SALE (Wholesale Dispatch)</option>
                  <option value="DAMAGE_REPAIRABLE">DAMAGE: Repairable Stock</option>
                  <option value="DAMAGE_NON_REPAIRABLE">DAMAGE: Non-Repairable Scrap</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Quantity (pcs per SKU)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bulkQty}
                    onChange={(e) => setBulkQty(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required={bulkAction === 'SALE'}
                    placeholder="INV-1234"
                    value={bulkInvoice}
                    onChange={(e) => setBulkInvoice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Reference Code / PO</label>
                <input
                  type="text"
                  placeholder="PO-2026-004"
                  value={bulkRef}
                  onChange={(e) => setBulkRef(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Operational details on bulk batch dispatch..."
                  value={bulkRemarks}
                  onChange={(e) => setBulkRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800 resize-none"
                />
              </div>

              {bulkFeedback.error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 leading-relaxed font-semibold">
                  {bulkFeedback.error}
                </div>
              )}
              {bulkFeedback.success && bulkFeedback.message && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3 leading-relaxed font-semibold">
                  {bulkFeedback.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Generating ledger dispatches...' : 'Execute Bulk Action'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------------
          EXCEL IMPORT DIALOG & COLUMN MAPPING ENGINE
          ----------------------------------------------------------------------------- */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-3xl w-full space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  <span>Knitwear Inventory Template Importer</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Upload Knitwear Import Template (.xlsx) to register variants or sync stock.</p>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Template Download Help Banner */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-slate-800 text-[11px] block">Dedicated Import Template Required</span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Start from our pre-defined format to bypass manual column mapping.</p>
                </div>
                <button
                  onClick={downloadCleanTemplate}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download size={14} className="text-slate-500" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Import Mode Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setImportMode('sync');
                    setMigrationReport(null);
                  }}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    importMode === 'sync' ? 'bg-slate-50 border-slate-800 text-slate-900 font-bold' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-black">Mode 2: Ongoing Sync</span>
                  <span className="text-[10px] font-medium mt-1 leading-relaxed text-slate-500">Compare uploaded Excel stocks vs लाइव values & submit approval differences.</span>
                </button>
                <button
                  onClick={() => {
                    setImportMode('migration');
                    setMigrationReport(null);
                  }}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    importMode === 'migration' ? 'bg-slate-50 border-slate-800 text-slate-900 font-bold' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-black">Mode 1: Initial Migration</span>
                  <span className="text-[10px] font-medium mt-1 leading-relaxed text-slate-500">Register brand new variants, update metadata for pre-existing barcodes, and seed starting available stocks.</span>
                </button>
              </div>

              {/* File Input */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50 space-y-2">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-extrabold shadow-sm cursor-pointer hover:bg-slate-50"
                >
                  Choose Excel Workbook
                </button>
                <p className="text-[10px] text-slate-400">Supports "Knitwear_Inventory_Template.xlsx"</p>
              </div>

              {/* Preview Table */}
              {excelData.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700">Workbook Data Loaded: {excelData.length} records</span>
                    <span className="text-[10px] text-emerald-600 font-black flex items-center gap-1">
                      <ShieldCheck size={12} />
                      <span>Template mapping verified! Ready to import.</span>
                    </span>
                  </div>

                  {/* First 10 rows Parsed Preview Table */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Sheet Data Preview (First 10 records)</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase font-black">
                            <th className="px-3 py-2 font-mono">Row #</th>
                            {excelHeaders.slice(0, 8).map(h => (
                              <th key={h} className="px-3 py-2">{h}</th>
                            ))}
                            {excelHeaders.length > 8 && <th className="px-3 py-2 text-slate-400">...</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {excelData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-white transition-colors bg-white/50">
                              <td className="px-3 py-1.5 font-bold font-mono text-slate-400">{idx + 2}</td>
                              {excelHeaders.slice(0, 8).map(h => (
                                <td key={h} className="px-3 py-1.5 font-medium truncate max-w-[120px]" title={String(row[h] || '')}>
                                  {String(row[h] || '')}
                                </td>
                              ))}
                              {excelHeaders.length > 8 && <td className="px-3 py-1.5 text-slate-400 font-bold">...</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {/* Validation Feedback */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold"><AlertCircle size={14} /><span>Validation Errors Detected:</span></div>
                  <ul className="list-disc list-inside max-h-24 overflow-y-auto pl-1 text-[11px] font-medium leading-relaxed font-mono">
                    {validationErrors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                    {validationErrors.length > 10 && <li>...and {validationErrors.length - 10} more issues.</li>}
                  </ul>
                </div>
              )}

              {importFeedback && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 leading-relaxed font-bold">
                  {importFeedback}
                </div>
              )}

              {/* Mode 1 Initial Migration Report Summary */}
              {migrationReport && (
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-widest font-mono">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>LJK Workbook Migration Report</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white border border-slate-200 p-3 rounded-xl">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">Styles Seeder</span>
                      <span className="text-lg font-black text-slate-900 block mt-0.5">{migrationReport.totalProductsImported}</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-3 rounded-xl">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">Variants Registered</span>
                      <span className="text-lg font-black text-slate-900 block mt-0.5">{migrationReport.totalVariantsImported}</span>
                    </div>
                    <div className="bg-white border border-slate-200 p-3 rounded-xl">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">Transactions Posted</span>
                      <span className="text-lg font-black text-emerald-600 block mt-0.5">{migrationReport.totalInventoryImported}</span>
                    </div>
                  </div>
                  {migrationReport.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3.5 space-y-1">
                      <span className="font-bold block text-[11px] uppercase">Encountered Discrepancies/Errors:</span>
                      <ul className="list-disc list-inside max-h-24 overflow-y-auto text-[10px] font-semibold leading-relaxed">
                        {migrationReport.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    </div>
                  )}
                  {migrationReport.skipped.length > 0 && (
                    <div className="bg-slate-100 border border-slate-200 text-slate-500 rounded-xl p-3.5 space-y-1">
                      <span className="font-bold block text-[11px] uppercase">Duplicate Barcodes Skipped (Pre-existing):</span>
                      <p className="text-[10px] font-semibold leading-relaxed">Total variants skipped: {migrationReport.skipped.length}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions footer */}
              {excelData.length > 0 && (
                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setExcelData([]);
                      setValidationErrors([]);
                      setMigrationReport(null);
                    }}
                    className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold cursor-pointer"
                  >
                    Clear File
                  </button>
                  <button
                    onClick={handleImportApply}
                    disabled={isPending}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-extrabold cursor-pointer"
                  >
                    {isPending ? 'Processing Workbook sheets...' : importMode === 'sync' ? 'Run Sync Adjustments' : 'Commit Initial Migration'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STYLE REGISTRATION DIALOGS (PRODUCT STYLE & SKU) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <PlusCircle size={16} className="text-slate-800" />
                  <span>Register Product Style</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Register a generalized knitwear style template.</p>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form action={async (fd) => {
              startTransition(async () => {
                const res = await createProductAction({}, fd);
                if (res.success) {
                  setTimeout(() => {
                    setIsProductModalOpen(false);
                  }, 2000);
                }
              });
            }} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Style Template Name</label>
                <input
                  type="text"
                  name="productName"
                  required
                  placeholder="e.g. Heritage Poncho"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Category</label>
                  <select
                    name="category"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                  >
                    <option value="Ponchos">Ponchos</option>
                    <option value="Capes">Capes</option>
                    <option value="Sweaters">Sweaters</option>
                    <option value="Jumpers">Jumpers</option>
                    <option value="Shawls">Shawls</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Subcategory</label>
                  <input
                    type="text"
                    name="subcategory"
                    placeholder="Classic, Loose ply"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Brand</label>
                  <input
                    type="text"
                    name="brand"
                    defaultValue="LJK Knitwear"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Season</label>
                  <input
                    type="text"
                    name="season"
                    placeholder="Winter 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Remarks / Desc</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Knit spec, wool grade details..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-slate-800 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Registering product style...' : 'Register Style Template'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isSkuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <PlusCircle size={16} className="text-slate-800" />
                  <span>Register Variant SKU</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Register a unique variant. System automatically binds size/color relations.</p>
              </div>
              <button onClick={() => setIsSkuModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form action={async (fd) => {
              startTransition(async () => {
                const res = await createVariantAction({}, fd);
                if (res.success) {
                  setTimeout(() => {
                    setIsSkuModalOpen(false);
                  }, 2000);
                } else {
                  alert(`Variant creation failed: ${res.error}`);
                }
              });
            }} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Parent Style Template</label>
                <select
                  name="productId"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none font-sans"
                >
                  <option value="">Select style template...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.productName} ({p.category})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Barcode (PUK - Must be unique)</label>
                  <input
                    type="text"
                    name="barcode"
                    required
                    placeholder="e.g. 110000000005"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">SKU Code (Leave blank to auto-generate)</label>
                  <input
                    type="text"
                    name="sku"
                    placeholder="e.g. PONCHO-NAVY-FS"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Color Name</label>
                  <input
                    type="text"
                    name="colorName"
                    required
                    placeholder="Beige, Charcoal"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Size Name</label>
                  <input
                    type="text"
                    name="sizeName"
                    required
                    placeholder="Free Size, L, XL"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    name="costPrice"
                    required
                    min="1"
                    placeholder="1650"
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Wholesale (₹)</label>
                  <input
                    type="number"
                    name="wholesalePrice"
                    required
                    min="1"
                    placeholder="2850"
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">MRP Retail (₹)</label>
                  <input
                    type="number"
                    name="mrp"
                    required
                    min="1"
                    placeholder="4995"
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Rack Location</label>
                  <input
                    type="text"
                    name="rackLocation"
                    required
                    placeholder="e.g. A-03"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Registering variant SKU...' : 'Register Variant SKU'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && selectedVariant && (
        <div 
          onClick={() => setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl animate-fade-in"
          >
            <div className="flex items-start gap-3 text-red-600 pb-2 border-b border-slate-100">
              <AlertTriangle className="shrink-0 animate-pulse" size={24} />
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">Confirm Permanent SKU Deletion</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Style: {selectedVariant.productName} ({selectedVariant.sku})</p>
              </div>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed font-medium">
              Are you sure you want to permanently delete this SKU and all associated inventory records? This action cannot be undone.
            </p>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase">
                Type <span className="font-mono text-red-500 font-extrabold select-all">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="Type DELETE..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-red-500 uppercase tracking-wider font-mono"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmInput !== 'DELETE'}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-black transition-all shadow-md shadow-red-100 cursor-pointer font-sans"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
