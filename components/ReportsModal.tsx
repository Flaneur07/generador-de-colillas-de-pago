import React, { useState, useMemo } from 'react';
import { X, BarChart3, Users, DollarSign, Calendar, Search, FileDown } from 'lucide-react';
import { Client } from '../types';
import { formatCurrency } from '../utils/currency';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
}

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, clients }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [searchTerm, setSearchTerm] = useState('');

  const reportData = useMemo(() => {
    // Filtrar solo los que tienen pago > 0 en el mes seleccionado
    const paidClients = clients.filter(client => {
      const paymentValue = client.payments?.[selectedMonth] || 0;
      const matchesSearch = client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           String(client.numeroContrato).includes(searchTerm);
      return paymentValue > 0 && matchesSearch;
    });

    const totalAmount = paidClients.reduce((sum, client) => sum + (client.payments?.[selectedMonth] || 0), 0);
    const totalCount = paidClients.length;

    return {
      paidClients,
      totalAmount,
      totalCount
    };
  }, [clients, selectedMonth, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Reporte de Pagos</h2>
              <p className="text-xs text-slate-400">Análisis de recaudación mensual</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 p-6 gap-6">
          
          {/* Controls & Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
            
            {/* Month & Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                  <Calendar className="h-3 w-3" /> Seleccionar Mes
                </label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {months.map(m => <option key={m} value={m}>{m} 2026</option>)}
                </select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filtrar en este reporte..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Total Amount Card */}
            <div className="bg-blue-600 rounded-xl shadow-lg p-5 text-white flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-full">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total Recaudado</p>
                <p className="text-3xl font-black">{formatCurrency(reportData.totalAmount)}</p>
              </div>
            </div>

            {/* Total Count Card */}
            <div className="bg-slate-800 rounded-xl shadow-lg p-5 text-white flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-full">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Pagadores</p>
                <p className="text-3xl font-black">{reportData.totalCount}</p>
              </div>
            </div>

          </div>

          {/* Table Container */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                Lista de Pagos - {selectedMonth} 2026
              </h3>
              <button className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                <FileDown className="h-3 w-3" /> Exportar (Próximamente)
              </button>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px]">Póliza</th>
                    <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px]">Nombre del Cliente</th>
                    <th className="px-6 py-3 font-bold text-slate-600 uppercase text-[10px] text-right">Valor Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.paidClients.length > 0 ? (
                    reportData.paidClients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{client.numeroContrato}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{client.nombre}</td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {formatCurrency(client.payments[selectedMonth] || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                        No se registraron pagos para el mes de {selectedMonth} o no coinciden con la búsqueda.
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