import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { Download, Printer, Calendar } from 'lucide-react';
import { formatCurrency, numberToWords } from '../utils/currency';
import { generatePaymentSlip, printPaymentSlip } from '../services/pdfService';
import { SiteConfig } from '../config/siteConfigs';

interface PDFPreviewProps {
  client: Client | null;
  siteConfig: SiteConfig;
}

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const PDFPreview: React.FC<PDFPreviewProps> = ({ client, siteConfig }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isAnualSelected, setIsAnualSelected] = useState<boolean>(false);
  const [receiptNumber, setReceiptNumber] = useState<string>("00000");

  useEffect(() => {
    if (client) {
      const currentMonthIdx = new Date().getMonth();
      const currentMonthKey = months[currentMonthIdx];
      setSelectedMonth(currentMonthKey);
      setIsAnualSelected(false);
      // Generate a random-ish starting number if empty
      if (!receiptNumber || receiptNumber === "00000") {
        const randomNum = Math.floor(10000 + Math.random() * 90000).toString();
        setReceiptNumber(randomNum);
      }
    }
  }, [client]);

  if (!client) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="p-4 bg-slate-50 rounded-full mb-4">
          <Printer className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-medium text-slate-900">Vista Previa</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-xs">
          Selecciona un cliente para ver y configurar el Recibo de Caja.
        </p>
      </div>
    );
  }

  const isClientFullYear = client.payments
    ? months.slice(0, 11).every(m => (client.payments?.[m] || 0) > 0)
    : false;

  const selectedValue = isAnualSelected
    ? months.reduce((sum, m) => sum + (client.payments?.[m] || 0), 0)
    : (client.payments?.[selectedMonth] || 0);

  const selectedConcept = isAnualSelected
    ? "PAGO PERIODICIDAD ANUAL - 2026"
    : `Mensualidad ${selectedMonth} 2026`;

  const today = new Date().toLocaleDateString('es-CO');

  const handleDownload = () => {
    const tempClient: Client = {
      ...client,
      valorCompra: selectedValue,
      concepto: selectedConcept
    };
    generatePaymentSlip(tempClient, siteConfig, receiptNumber);
  };

  const handlePrint = () => {
    const tempClient: Client = {
      ...client,
      valorCompra: selectedValue,
      concepto: selectedConcept
    };
    printPaymentSlip(tempClient, siteConfig, receiptNumber);
  };

  const displayObs = client.observaciones
    ? client.observaciones
    : (client.telefono ? `Teléfono: ${client.telefono}` : '') + (client.correo ? ` - Correo: ${client.correo}` : '');

  return (
    <>
      <div className="flex flex-col h-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Configurar Recibo</h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded shadow transition-colors"
                title="Imprimir colilla"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">IMPRIMIR</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2 px-3 rounded shadow transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">DESCARGAR</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Receipt Number */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                N° de Recibo
              </label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-bold text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Month Selector Header */}
            <div className="flex items-end mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">
                Mes de Pago
              </label>
            </div>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-6 gap-2">
            {months.map((m) => {
              const val = client.payments?.[m] || 0;
              const hasValue = val > 0;
              const isSelected = !isAnualSelected && selectedMonth === m;

              return (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonth(m);
                    setIsAnualSelected(false);
                  }}
                  className={`
                    px-1 py-1.5 rounded text-[10px] border transition-all flex flex-col items-center justify-center
                    ${isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-100'
                      : hasValue
                        ? 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        : 'bg-slate-50 text-slate-300 border-slate-100'
                    }
                  `}
                >
                  <span className="font-bold">{m}</span>
                  {hasValue && <span className="text-[8px] opacity-80">${val / 1000}k</span>}
                </button>
              );
            })}

            {/* Anual Option */}
            <button
              onClick={() => setIsAnualSelected(true)}
              className={`
                px-1 py-1.5 rounded text-[10px] border transition-all flex flex-col items-center justify-center col-span-2
                ${isAnualSelected
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-100'
                  : isClientFullYear
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-300 border-slate-100 opacity-50'
                }
              `}
            >
              <span className="font-black">TODO EL AÑO</span>
              {isClientFullYear && <span className="text-[7px] font-bold">CALIFICADO</span>}
            </button>
          </div>
        </div>

        {/* Paper Receipt Simulation */}
        <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-200/50">
          <div className="bg-white p-6 shadow-xl w-full max-w-[600px] text-[10px] sm:text-xs font-sans border border-slate-300 relative">

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="w-1/3">
                <img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
              </div>
              <div className="w-1/3 text-center">
                <div className="text-[8px] font-bold">Nit: {siteConfig.nit}</div>
                <div className="text-[8px]">Régimen Simplificado</div>
                <div className="text-[9px] font-bold text-green-800">ORGANIZACIÓN SERVICIOS FUNERARIOS</div>
                <div className="text-[8px] font-bold">{siteConfig.city}</div>
              </div>
              <div className="w-1/3 flex justify-end">
                <div className="border-2 border-slate-800 rounded px-2 py-1 text-center bg-slate-50">
                  <div className="text-[7px] font-black border-b border-slate-300 pb-0.5 mb-0.5">RECIBO DE CAJA</div>
                  <div className="text-red-600 font-bold text-lg">No. {receiptNumber}</div>
                </div>
              </div>
            </div>

            {/* Form Rows */}
            <div className="border border-slate-800 border-b-0">
              {/* Row 1 */}
              <div className="flex border-b border-slate-800">
                <div className="w-2/3 border-r border-slate-800 p-1.5 flex gap-2">
                  <span className="shrink-0 font-medium">Fecha:</span>
                  <span className="font-bold underline">{today}</span>
                </div>
                <div className="w-1/3 p-1.5 flex gap-2">
                  <span className="shrink-0 font-medium">Valor: $</span>
                  <span className={`font-bold text-sm ${selectedValue === 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency(selectedValue).replace('$', '').trim()}
                  </span>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex border-b border-slate-800 p-1.5 gap-2">
                <span className="shrink-0 font-medium whitespace-nowrap">Recibimos de:</span>
                <span className="font-bold uppercase flex-1 border-b border-slate-300">{client.nombre}</span>
              </div>

              {/* Row 3 */}
              <div className="flex border-b border-slate-800 p-1.5 gap-2">
                <span className="shrink-0 font-medium whitespace-nowrap">La suma de:</span>
                <span className="font-bold italic text-[9px] uppercase flex-1 border-b border-slate-300 leading-tight">
                  {numberToWords(selectedValue)}
                </span>
              </div>

              {/* Row 4 */}
              <div className="flex border-b border-slate-800 p-1.5 gap-2">
                <span className="shrink-0 font-medium whitespace-nowrap">Por concepto de:</span>
                <span className="font-bold uppercase flex-1 border-b border-slate-300">{selectedConcept}</span>
              </div>

              {/* Row 5 */}
              <div className="flex border-b border-slate-800 p-1.5 gap-2">
                <span className="shrink-0 font-medium whitespace-nowrap">Contrato / Póliza:</span>
                <span className="font-bold flex-1 border-b border-slate-300">{client.numeroContrato}</span>
              </div>

              {/* Row 6 */}
              <div className="flex border-b border-slate-800 p-1.5 h-14 gap-2">
                <span className="shrink-0 font-medium">Observaciones:</span>
                <div className="flex-1 text-slate-600 italic leading-tight">
                  {displayObs}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex mt-4 gap-4">
              <div className="w-3/5 border-2 border-slate-800 rounded-lg p-2 text-center text-[9px]">
                <div className="font-bold uppercase text-slate-800">{siteConfig.address}</div>
                <div className="text-[8px] my-0.5">Líneas de Atención:</div>
                <div className="font-bold text-slate-800">{siteConfig.phones}</div>
              </div>
              <div className="w-2/5 border-2 border-slate-800 rounded-lg p-2 relative bg-slate-50">
                <div className="absolute bottom-2 left-4 right-4 border-t-2 border-slate-800 text-center pt-1 text-[8px] font-bold uppercase text-slate-800">
                  Firma Autorizada
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </>
  );
};