import React, { useState, useMemo, useEffect } from 'react';
import { X, BarChart3, Users, DollarSign, Calendar, Search, FileDown, Loader2 } from 'lucide-react';
import { Client } from '../types';
import { formatCurrency } from '../utils/currency';
import * as XLSX from 'xlsx';
import { supabaseService } from '../services/supabaseService';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  siteId?: string;
}

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, clients, siteId }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [reportType, setReportType] = useState<'monthly' | 'anual' | 'daily'>('monthly');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Daily Report State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);

  useEffect(() => {
    if (isOpen && reportType === 'daily' && siteId && selectedDate) {
      setIsLoadingDaily(true);
      supabaseService.getDailyPayments(siteId, selectedDate).then(data => {
        const mapped = data.map((d: any) => {
          const client = clients.find(c => c.id === d.client_id);
          return {
            id: d.id,
            numeroContrato: client ? client.numeroContrato : 'N/A',
            nombre: client ? client.nombre : 'Desconocido',
            cedula: client ? client.cedula : '',
            amount: Number(d.amount),
            month: d.month
          };
        });
        setDailyPayments(mapped);
      }).catch(err => {
        console.error("Error fetching daily payments:", err);
      }).finally(() => {
        setIsLoadingDaily(false);
      });
    }
  }, [isOpen, reportType, siteId, selectedDate, clients]);

  const reportData = useMemo(() => {
    if (reportType === 'daily') {
      const filtered = dailyPayments.filter(dp => {
        const term = searchTerm.toLowerCase().trim();
        return (
          dp.nombre.toLowerCase().includes(term) ||
          String(dp.numeroContrato).toLowerCase().includes(term) ||
          (dp.cedula && String(dp.cedula).toLowerCase().includes(term))
        );
      });
      
      return {
        paidItems: filtered,
        totalAmount: filtered.reduce((sum, item) => sum + item.amount, 0),
        totalCount: filtered.length
      };
    }

    const isFullYear = (client: Client) =>
      months.slice(0, 11).every(m => (client.payments?.[m] || 0) > 0);

    const paidClients = clients.filter(client => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = client.nombre.toLowerCase().includes(term) ||
        String(client.numeroContrato).toLowerCase().includes(term) ||
        (client.cedula && String(client.cedula).toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (reportType === 'anual') {
        return isFullYear(client);
      } else {
        const paymentValue = client.payments?.[selectedMonth] || 0;
        return paymentValue > 0 && !isFullYear(client);
      }
    });

    const totalAmount = paidClients.reduce((sum, client) => {
      if (reportType === 'anual') {
        return sum + months.reduce((mSum, m) => mSum + (client.payments?.[m] || 0), 0);
      }
      return sum + (client.payments?.[selectedMonth] || 0);
    }, 0);

    return {
      paidItems: paidClients.map(client => {
        const amount = reportType === 'anual'
          ? months.reduce((sum, m) => sum + (client.payments?.[m] || 0), 0)
          : (client.payments?.[selectedMonth] || 0);
        return {
          id: client.id,
          numeroContrato: client.numeroContrato,
          nombre: client.nombre,
          amount,
          month: reportType === 'anual' ? 'Año Completo' : selectedMonth
        };
      }),
      totalAmount,
      totalCount: paidClients.length
    };
  }, [clients, selectedMonth, reportType, searchTerm, dailyPayments]);

  const handleExportExcel = () => {
    const reportLabel = reportType === 'anual' ? 'Anual_2026' : reportType === 'daily' ? `Diario_${selectedDate}` : `${selectedMonth}_2026`;
    const fileName = `Reporte_La_Fe_${reportLabel}.xlsx`;

    const rows = reportData.paidItems.map((item) => ({
      'Póliza / Contrato': item.numeroContrato,
      'Nombre del Cliente': item.nombre,
      'Mes Pagado': item.month,
      'Valor Pagado': item.amount,
    }));

    rows.push({
      'Póliza / Contrato': '',
      'Nombre del Cliente': `TOTAL (${reportData.totalCount} registros)`,
      'Mes Pagado': '',
      'Valor Pagado': reportData.totalAmount,
    } as any);

    const ws = XLSX.utils.json_to_sheet(rows);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 40 },
      { wch: 15 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportLabel.replace('_', ' '));
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Reporte de Pagos</h2>
              <p className="text-xs text-slate-400">Análisis de recaudación mensual y diario</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 p-6 gap-6">

          {/* Toolbar & Summary Row */}
          <div className="flex flex-col xl:flex-row gap-4 shrink-0">

            {/* Config & Search */}
            <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400 hidden sm:block" />
                <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                  <button
                    onClick={() => setReportType('daily')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${reportType === 'daily' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    DIARIO
                  </button>
                  <button
                    onClick={() => setReportType('monthly')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${reportType === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    MENSUAL
                  </button>
                  <button
                    onClick={() => setReportType('anual')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${reportType === 'anual' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    ANUAL
                  </button>
                </div>
              </div>

              {reportType === 'monthly' && (
                <div className="w-40">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    {months.map(m => <option key={m} value={m}>{m} 2026</option>)}
                  </select>
                </div>
              )}

              {reportType === 'daily' && (
                <div className="w-40">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  />
                </div>
              )}

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar póliza o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Summary Cards */}
            <div className="flex gap-4">
              <div className={`rounded-xl shadow-sm p-3 px-5 text-white flex items-center gap-3 min-w-[200px] ${reportType === 'daily' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                <div className="bg-white/20 p-2 rounded-full">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Recaudo Total</p>
                  <p className="text-xl font-black tabular-nums">{formatCurrency(reportData.totalAmount)}</p>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl shadow-sm p-3 px-5 text-white flex items-center gap-3 min-w-[150px]">
                <div className="bg-white/10 p-2 rounded-full">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Registros</p>
                  <p className="text-xl font-black tabular-nums">{reportData.totalCount}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Table Container */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
            {isLoadingDaily && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
              </div>
            )}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                Lista de Pagos - {reportType === 'anual' ? 'Año 2026' : reportType === 'daily' ? `Día ${selectedDate}` : `${selectedMonth} 2026`}
              </h3>
              <button
                onClick={handleExportExcel}
                className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> Exportar Excel
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 sticky top-0 z-20 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Póliza</th>
                    <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-[10px]">Nombre del Cliente</th>
                    <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-center">Mes</th>
                    <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] text-right">Valor Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {reportData.paidItems.length > 0 ? (
                    reportData.paidItems.map((item, idx) => (
                      <tr key={item.id + idx} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-6 py-3 font-mono text-xs text-slate-500 group-hover:text-blue-600 transition-colors">{item.numeroContrato}</td>
                        <td className="px-6 py-3 font-bold text-slate-800">{item.nombre}</td>
                        <td className="px-6 py-3 text-center font-bold text-slate-500 text-xs uppercase">{item.month}</td>
                        <td className="px-6 py-3 text-right font-black text-slate-900 tabular-nums">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        No se registraron pagos para la selección actual o no coinciden con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-4 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
          >
            Cerrar Reporte
          </button>
        </div>

      </div>
    </div>
  );
};