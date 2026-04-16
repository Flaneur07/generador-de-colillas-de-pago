import React, { useState } from 'react';
import { Client } from '../types';
import { formatCurrency } from '../utils/currency';
import { Search, UserCheck, MousePointerClick } from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  selectedClient: Client | null;
  onSelectClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
}

export const ClientList: React.FC<ClientListProps> = ({ clients, selectedClient, onSelectClient, onEditClient }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter(client => 
    client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(client.cedula).includes(searchTerm) // Cedula field now holds Poliza
  );

  if (clients.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
      {/* Table Header / Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            Registros Cargados ({filteredClients.length})
          </h2>
          <p className="text-sm text-slate-500 flex items-center gap-1">
             <MousePointerClick className="h-3 w-3" />
             Doble clic en un registro para editar detalles.
          </p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por Nombre o Póliza..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Scrollable Table Area (Horizontal & Vertical) */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-200 w-12">#</th>
              <th className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-200 min-w-[100px]">No. Póliza</th>
              <th className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-200 min-w-[250px]">Apellidos y Nombre</th>
              <th className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Pago {new Date().toLocaleString('es-ES', { month: 'short' }).replace('.', '').toUpperCase()}</th>
              <th className="px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Grupo Familiar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredClients.length > 0 ? (
              filteredClients.map((client, idx) => {
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                const currentMonthName = months[new Date().getMonth()];
                const monthlyPayment = client.payments?.[currentMonthName] || 0;
                
                const isSelected = selectedClient?.id === client.id;
                const benCount = client.beneficiaries?.length || 0;
                
                return (
                  <tr 
                    key={client.id} 
                    onClick={() => onSelectClient(client)}
                    onDoubleClick={() => onEditClient(client)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : 'even:bg-slate-50/50'}`}
                    title="Doble clic para editar"
                  >
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {client.numeroContrato}
                    </td>
                    <td className={`px-4 py-3 font-medium ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                      {client.nombre}
                    </td>
                    <td className={`px-4 py-3 font-bold ${monthlyPayment === 0 ? 'text-slate-300' : 'text-green-700'}`}>
                      {formatCurrency(monthlyPayment)}
                    </td>
                    <td className="px-4 py-3">
                      {benCount > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                          {benCount} {benCount === 1 ? 'beneficiario' : 'beneficiarios'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-medium">Sin beneficiarios</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <p className="font-medium">No se encontraron datos.</p>
                    <p className="text-xs mt-1">Verifica la búsqueda o el archivo cargado.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};