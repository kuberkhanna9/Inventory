'use client';

import { useState, useEffect } from 'react';
import { X, Printer, LayoutGrid, CheckSquare, Square } from 'lucide-react';
import type { ComputedInventoryItem } from '@/utils/db';

interface BarcodeLabelsProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariants: ComputedInventoryItem[];
}

export default function BarcodeLabels({ isOpen, onClose, selectedVariants }: BarcodeLabelsProps) {
  const [layout, setLayout] = useState<'single' | 'bulk' | 'a4'>('single');
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [bulkQuantities, setBulkQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || selectedVariants.length === 0) return null;

  const currentVariant = selectedVariants[activeVariantIndex] || selectedVariants[0];

  // Helper to generate visual barcode vertical lines using variant's barcode digits
  const renderVisualBarcode = (barcode: string) => {
    const digits = barcode.replace(/[^0-9]/g, '') || '110000000001';
    // Generate an array of line widths based on barcode digits
    const lines = [];
    for (let i = 0; i < 35; i++) {
      const digitVal = Number(digits[i % digits.length]) || 0;
      const isBlack = (i + digitVal) % 2 === 0;
      const width = isBlack ? (digitVal % 3 === 0 ? 'w-[3px]' : digitVal % 2 === 0 ? 'w-[2px]' : 'w-[1px]') : 'w-[2px]';
      lines.push({ isBlack, width });
    }

    return (
      <div className="flex items-end justify-center h-12 w-full bg-white px-2">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`${line.isBlack ? 'bg-black' : 'bg-transparent'} ${line.width} h-full`}
          />
        ))}
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const getBulkQuantity = (vId: string) => bulkQuantities[vId] || 1;

  const setBulkQuantity = (vId: string, val: number) => {
    setBulkQuantities({ ...bulkQuantities, [vId]: Math.max(1, val) });
  };

  return (
    <div 
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print"
    >
      {/* Printable Area (visible only during print via custom @media print style sheet) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main UI Dialog */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-4xl w-full flex flex-col md:flex-row gap-6 shadow-2xl max-h-[90vh] overflow-hidden no-print">
        {/* Settings Panel */}
        <div className="w-full md:w-80 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <Printer size={16} className="text-slate-800" />
                <span>Barcode Label Studio</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Configure layout and print standard barcodes.</p>
            </div>

            {/* Layout Picker */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase">Print Layout Format</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setLayout('single')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    layout === 'single' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setLayout('bulk')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    layout === 'bulk' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Bulk List
                </button>
                <button
                  onClick={() => setLayout('a4')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    layout === 'a4' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  A4 Grid
                </button>
              </div>
            </div>

            {/* Variant Selector for Single Layout */}
            {layout === 'single' && selectedVariants.length > 1 && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase">Select Target Variant</label>
                <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                  {selectedVariants.map((v, idx) => (
                    <button
                      key={v.variantId}
                      onClick={() => setActiveVariantIndex(idx)}
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        activeVariantIndex === idx ? 'bg-slate-50 font-bold text-slate-900' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {v.sku} - {v.colorName} ({v.sizeName})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity adjusters for Bulk/A4 layouts */}
            {(layout === 'bulk' || layout === 'a4') && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase">Print Quantities</label>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs bg-slate-50">
                  {selectedVariants.map(v => (
                    <div key={v.variantId} className="flex justify-between items-center px-3 py-2 bg-white">
                      <span className="font-extrabold text-[11px] text-slate-700 truncate max-w-[140px]">{v.sku}</span>
                      <input
                        type="number"
                        min="1"
                        value={getBulkQuantity(v.variantId)}
                        onChange={(e) => setBulkQuantity(v.variantId, Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded-lg px-1.5 py-1 text-center font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer text-center"
            >
              Print Sheet
            </button>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <LayoutGrid size={12} />
              <span>Live Print Preview Area</span>
            </span>
            <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Render target formats */}
          <div className="flex-1 overflow-y-auto max-h-[50vh] flex items-center justify-center p-4 bg-slate-200/50 rounded-xl border border-slate-100 print-area">
            {layout === 'single' && currentVariant && (
              <div className="bg-white border border-slate-300 w-[240px] p-4 rounded-lg shadow-md flex flex-col items-center justify-center space-y-3 text-slate-900 select-none">
                <span className="text-[10px] font-extrabold tracking-widest text-slate-500 uppercase">LJK KNITWEAR</span>
                <span className="text-[12px] font-black text-center truncate max-w-full">{currentVariant.productName}</span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{currentVariant.sku}</span>
                
                {renderVisualBarcode(currentVariant.barcode)}
                
                <span className="text-[10px] font-mono tracking-widest font-bold">{currentVariant.barcode || '110000000001'}</span>
                
                <div className="flex justify-between w-full text-[9px] font-bold border-t border-dashed border-slate-200 pt-2 text-slate-500 uppercase">
                  <span>Col: {currentVariant.colorName}</span>
                  <span>Sz: {currentVariant.sizeName}</span>
                </div>
                
                <div className="text-xs font-black text-slate-900 border-t border-slate-100 w-full text-center pt-1.5">
                  MRP: ₹{currentVariant.mrp}
                </div>
              </div>
            )}

            {layout === 'bulk' && (
              <div className="w-full space-y-4">
                {selectedVariants.map(v => {
                  const qty = getBulkQuantity(v.variantId);
                  return Array.from({ length: qty }).map((_, i) => (
                    <div key={`${v.variantId}-${i}`} className="bg-white border border-slate-300 w-[240px] mx-auto p-4 rounded-lg flex flex-col items-center justify-center space-y-3 text-slate-900 select-none">
                      <span className="text-[10px] font-extrabold tracking-widest text-slate-500 uppercase">LJK KNITWEAR</span>
                      <span className="text-[12px] font-black text-center truncate max-w-full">{v.productName}</span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{v.sku}</span>
                      
                      {renderVisualBarcode(v.barcode)}
                      
                      <span className="text-[10px] font-mono tracking-widest font-bold">{v.barcode}</span>
                      
                      <div className="flex justify-between w-full text-[9px] font-bold border-t border-dashed border-slate-200 pt-2 text-slate-500 uppercase">
                        <span>Col: {v.colorName}</span>
                        <span>Sz: {v.sizeName}</span>
                      </div>
                      
                      <div className="text-xs font-black text-slate-900 border-t border-slate-100 w-full text-center pt-1.5">
                        MRP: ₹{v.mrp}
                      </div>
                    </div>
                  ));
                })}
              </div>
            )}

            {layout === 'a4' && (
              <div className="bg-white border border-slate-300 p-6 shadow-sm w-full max-w-[210mm] min-h-[297mm] grid grid-cols-3 gap-4 text-slate-900 select-none">
                {selectedVariants.flatMap(v => {
                  const qty = getBulkQuantity(v.variantId);
                  return Array.from({ length: qty }).map((_, i) => (
                    <div key={`${v.variantId}-${i}`} className="border border-dashed border-slate-200 p-3 flex flex-col items-center justify-center space-y-2 text-center h-[90mm] bg-white rounded-lg">
                      <span className="text-[8px] font-extrabold tracking-widest text-slate-400 uppercase">LJK KNITWEAR</span>
                      <span className="text-[10px] font-black leading-tight truncate w-full">{v.productName}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{v.sku}</span>
                      
                      {renderVisualBarcode(v.barcode)}
                      
                      <span className="text-[8px] font-mono font-bold">{v.barcode}</span>
                      
                      <div className="flex justify-between w-full text-[8px] font-semibold text-slate-500 uppercase">
                        <span>Color: {v.colorName}</span>
                        <span>Size: {v.sizeName}</span>
                      </div>
                      
                      <div className="text-[10px] font-black text-slate-800 border-t border-slate-100 w-full pt-1">
                        MRP: ₹{v.mrp}
                      </div>
                    </div>
                  ));
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
