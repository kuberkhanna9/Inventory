'use client';

import { useState } from 'react';
import { ComputedInventoryItem, StockTransaction, ProductVariant } from '@/utils/types';
import { 
  FileSpreadsheet, 
  Download, 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Wrench,
  ShoppingBag,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  userRole: 'SUPERADMIN' | 'ACCOUNTS' | 'INVENTORY' | 'RETAIL';
  inventoryItems: ComputedInventoryItem[];
  transactions: StockTransaction[];
  variants: ProductVariant[];
}

type ReportType = 'VALUATION' | 'MOVEMENT' | 'DAMAGE' | 'SALES' | 'LOW_STOCK';

export default function ReportsView({ userRole, inventoryItems, transactions, variants }: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>('VALUATION');

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const isAccounts = userRole === 'ACCOUNTS';
  const isSuperAdmin = userRole === 'SUPERADMIN';

  // -----------------------------------------------------------------------------
  // DYNAMIC REPORT DATA FILTERING
  // -----------------------------------------------------------------------------
  const getReportData = () => {
    switch (reportType) {
      case 'VALUATION':
        return inventoryItems.map(item => ({
          'SKU Code': item.sku,
          'Product Name': item.productName,
          'Category': item.category,
          'Rack Location': item.rackLocation,
          'Ready Stock': item.readyStock,
          'Cost Price (₹)': item.costPrice,
          'Inventory Cost Value (₹)': item.inventoryCostValue,
          'Wholesale Price (₹)': item.wholesalePrice,
          'Inventory Wholesale Value (₹)': item.inventoryWholesaleValue,
          'Retail Price MRP (₹)': item.mrp,
          'Inventory Retail Value (₹)': item.inventoryRetailValue,
          'Status': item.status
        }));

      case 'MOVEMENT':
        return transactions.map(tx => {
          const v = variants.find(x => x.id === tx.variantId);
          return {
            'Timestamp': new Date(tx.createdAt).toLocaleString(),
            'SKU Code': v ? v.sku : 'N/A',
            'Movement Type': tx.transactionType,
            'Quantity (Units)': tx.quantity,
            'Reference Number': tx.referenceNumber || 'N/A',
            'Remarks': tx.remarks || 'No remarks',
            'Authorized By': tx.createdBy === 'admin-id-1234' ? 'John Admin' : 'Sarah Staff'
          };
        });

      case 'DAMAGE':
        return transactions
          .filter(t => t.transactionType === 'DAMAGE_REPAIRABLE' || t.transactionType === 'DAMAGE_NON_REPAIRABLE')
          .map(tx => {
            const v = variants.find(x => x.id === tx.variantId);
            return {
              'Timestamp': new Date(tx.createdAt).toLocaleString(),
              'SKU Code': v ? v.sku : 'N/A',
              'Damage Type': tx.transactionType === 'DAMAGE_REPAIRABLE' ? 'Repairable' : 'Scrap / Loss',
              'Quantity (Units)': tx.quantity,
              'Reference Number': tx.referenceNumber || 'N/A',
              'Remarks': tx.remarks || 'N/A',
              'Recorded By': tx.createdBy === 'admin-id-1234' ? 'John Admin' : 'Sarah Staff'
            };
          });

      case 'SALES':
        return transactions
          .filter(t => t.transactionType === 'SALE')
          .map(tx => {
            const v = variants.find(x => x.id === tx.variantId);
            const salePrice = v ? v.wholesalePrice : 0;
            const revenue = tx.quantity * salePrice;
            return {
              'Timestamp': new Date(tx.createdAt).toLocaleString(),
              'SKU Code': v ? v.sku : 'N/A',
              'Sale Units': tx.quantity,
              'Wholesale Price (₹)': salePrice,
              'Est. Sales Revenue (₹)': revenue,
              'Invoice': tx.invoiceNumber || 'N/A',
              'Remarks': tx.remarks || 'N/A'
            };
          });

      case 'LOW_STOCK':
        return inventoryItems
          .filter(item => item.readyStock <= 5) // Low stock threshold
          .map(item => ({
            'SKU Code': item.sku,
            'Product Name': item.productName,
            'Category': item.category,
            'Rack Location': item.rackLocation,
            'Current Stock': item.readyStock,
            'Status': item.status
          }));

      default:
        return [];
    }
  };

  const reportData = getReportData();

  // -----------------------------------------------------------------------------
  // EXPORT UTILITIES (EXCEL & CSV)
  // -----------------------------------------------------------------------------
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${reportType} Report`);
    
    // Style column widths
    const maxKeys = Object.keys(reportData[0] || {});
    ws['!cols'] = maxKeys.map(() => ({ wch: 22 }));

    XLSX.writeFile(wb, `LJK_Knitwear_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = Object.keys(reportData[0]);
    const csvRows = [
      headers.join(','), // Header row
      ...reportData.map(row => 
        headers.map(fieldName => {
          const value = (row as any)[fieldName];
          const escaped = ('' + value).replace(/"/g, '""'); // Escape double quotes
          return `"${escaped}"`;
        }).join(',')
      )
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LJK_Knitwear_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportTypesList = [
    { id: 'VALUATION', name: 'Inventory Valuation', desc: 'Detailed stock values at Cost, Wholesale, and MRP base', icon: TrendingUp },
    { id: 'MOVEMENT', name: 'Stock Movement Ledger', desc: 'Chronological timeline of all ledger transactions', icon: BarChart3 },
    { id: 'DAMAGE', name: 'Damage & Loss', desc: 'Review factory stock write-offs and damaged units', icon: Wrench },
    { id: 'SALES', name: 'Sales Outflow', desc: 'Track retail/wholesale stock dispatches & values', icon: ShoppingBag },
    { id: 'LOW_STOCK', name: 'Low Stock Alert', desc: 'Identify SKUs currently below their safety threshold', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Management Reporting</h1>
        <p className="text-slate-500 text-xs mt-1">Generate and export Excel/CSV reports for auditing, accounting, and supply planning.</p>
      </div>

      {/* Report Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {reportTypesList.map(type => {
          const Icon = type.icon;
          const isActive = reportType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => setReportType(type.id as ReportType)}
              className={`bg-white border rounded-3xl p-5 text-left flex flex-col justify-between h-36 transition-all duration-150 cursor-pointer hover:-translate-y-0.5 ${
                isActive 
                  ? 'border-slate-800 ring-1 ring-slate-800/10 shadow-sm' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-xl border w-max ${
                isActive 
                  ? 'bg-slate-800 text-white border-slate-700' 
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <Icon size={14} />
              </div>
              <div className="mt-4">
                <h4 className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wider">{type.name}</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-1 truncate max-w-[180px]">{type.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Table Preview and Export Buttons */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Report Preview</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Showing live compilation dataset ({reportData.length} records)</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={exportToCSV}
              disabled={reportData.length === 0}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm"
            >
              <Download size={12} />
              <span>Export CSV</span>
            </button>
            
            {/* Excel exports limited to SuperAdmin and Accounts Departments! */}
            {(isSuperAdmin || isAccounts) ? (
              <button
                onClick={exportToExcel}
                disabled={reportData.length === 0}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <FileSpreadsheet size={12} />
                <span>Export Excel Workbook</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl">
                <span>Excel Exports Restricted</span>
              </div>
            )}
          </div>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto max-h-[450px]">
          {reportData.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold text-xs">
              No compiled data available for this report criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                  {Object.keys(reportData[0]).map(key => (
                    <th key={key} className="px-6 py-4 whitespace-nowrap">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {Object.values(row).map((val: any, valIdx) => {
                      const isNumericStr = !isNaN(Number(val)) && typeof val === 'number';
                      return (
                        <td 
                          key={valIdx} 
                          className={`px-6 py-3 text-xs font-semibold whitespace-nowrap ${
                            isNumericStr ? 'text-slate-800' : 'text-slate-500'
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
