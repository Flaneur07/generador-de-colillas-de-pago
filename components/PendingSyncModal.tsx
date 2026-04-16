
import React from 'react';
import { X, Clock, Database, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { PendingSupabaseAction, supabaseQueueService } from '../services/syncQueueService';

interface PendingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  'createClient': 'Nuevo Cliente',
  'updatePayment': 'Actualizar Pago',
  'updateObservaciones': 'Actualizar Obs.',
  'deleteClient': 'Eliminar Cliente',
  'addBeneficiary': 'Nuevo Beneficiario',
  'deleteBeneficiary': 'Eliminar Beneficiario',
  'updateBeneficiaryStatus': 'Cambiar Estado Ben.'
};

export const PendingSyncModal: React.FC<PendingSyncModalProps> = ({ 
  isOpen, 
  onClose, 
  onSync, 
  isSyncing 
}) => {
  const [queue, setQueue] = React.useState<PendingSupabaseAction[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setQueue(supabaseQueueService.getQueue());
    }
  }, [isOpen, isSyncing]);

  if (!isOpen) return null;

  const handleRemove = (id: string) => {
    supabaseQueueService.dequeue(id);
    setQueue(supabaseQueueService.getQueue());
  };

  const handleClearAll = () => {
    if (confirm("¿Seguro que deseas limpiar todos los cambios pendientes de Supabase? Se perderán permanentemente.")) {
      supabaseQueueService.clear();
      setQueue([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden animate-bounce-in">
        <div className="bg-amber-500 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Cambios Pendientes de Sincronización</h3>
              <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Modo Offline Detectado</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-amber-600 p-1 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {queue.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No hay cambios pendientes en la cola.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Acción</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Póliza / Ref</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          item.type === 'createClient' ? 'bg-green-500' : 
                          item.type === 'deleteClient' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-sm font-bold text-slate-700">
                          {ACTION_LABELS[item.type] || item.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {item.clientId || 'Varios/Ninguno'} 
                        {item.payload.contract_number ? ` (${item.payload.contract_number})` : ''}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleRemove(item.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        title="Eliminar de la cola"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {queue.length > 0 && (
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <p className="text-[11px] font-bold uppercase">Estos cambios se aplicarán cuando haya conexión</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleClearAll}
                disabled={isSyncing}
                className="flex-1 sm:flex-none px-4 py-2.5 text-slate-500 font-bold text-xs hover:text-red-600 transition-colors"
              >
                LIMPIAR TODO
              </button>
              <button
                onClick={onSync}
                disabled={isSyncing || !navigator.onLine}
                className={`flex-1 sm:flex-none px-8 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-200/50 ${
                  !navigator.onLine ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
                }`}
              >
                {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {isSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR AHORA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
