
import React, { useState, useMemo } from 'react';
import { X, UserPlus, Fingerprint, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Client } from '../types';
import { supabaseService } from '../services/supabaseService';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  existingClients: Client[];
  siteId: string;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingClients,
  siteId
}) => {
  const [nombre, setNombre] = useState('');
  const [poliza, setPoliza] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'duplicate'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isDuplicate = useMemo(() => {
    if (!poliza.trim()) return false;
    return existingClients.some(client =>
      String(client.numeroContrato).trim().toLowerCase() === poliza.trim().toLowerCase()
    );
  }, [poliza, existingClients]);

  if (!isOpen) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDuplicate) {
      setStatus('duplicate');
      return;
    }

    if (!nombre || !poliza) {
      alert("Por favor completa los campos.");
      return;
    }


    setIsSyncing(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      const newClient = await supabaseService.createClient(siteId, {
        nombre: nombre.trim(),
        numeroContrato: poliza.trim()
      });

      setStatus('success');
      setTimeout(() => {
        onSave(newClient);
        onClose();
        setNombre('');
        setPoliza('');
        setStatus('idle');
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || "Error al conectar con Supabase.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="bg-green-600 text-white p-5 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Nuevo Registro 2026
          </h3>
          <button onClick={onClose} className="hover:bg-green-700 p-1 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-xs font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre y Apellidos</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
              disabled={isSyncing}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Número de Póliza</label>
            <div className="relative">
              <Fingerprint className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${isDuplicate ? 'text-red-500' : 'text-slate-300'}`} />
              <input
                type="text"
                value={poliza}
                onChange={(e) => {
                  setPoliza(e.target.value);
                  if (status === 'duplicate') setStatus('idle');
                }}
                placeholder="Número único"
                required
                disabled={isSyncing}
                className={`w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 outline-none font-mono disabled:opacity-50 transition-colors ${isDuplicate
                  ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
                  : 'border-slate-200 focus:ring-green-500 text-slate-900'
                  }`}
              />
            </div>
            {isDuplicate && (
              <p className="text-[10px] text-red-600 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" /> Este cliente ya existe. Debes elegir otro N° de póliza.
              </p>
            )}
          </div>

          <div className="pt-4 space-y-3">
            {status === 'success' && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 font-bold text-sm border border-green-100">
                <CheckCircle2 className="h-5 w-5" /> ¡Agregado a Supabase!
              </div>
            )}

            <button
              type="submit"
              disabled={isSyncing || isDuplicate || !nombre || !poliza}
              className={`w-full py-4 rounded-xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isSyncing ? 'bg-slate-400' :
                isDuplicate ? 'bg-red-200 text-red-400 cursor-not-allowed shadow-none' :
                  (!nombre || !poliza) ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' :
                    'bg-slate-900 text-white hover:bg-black'
                }`}
            >
              {isSyncing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {isDuplicate ? 'PÓLIZA DUPLICADA' : isSyncing ? 'GUARDANDO...' : 'CREAR CLIENTE EN BASE DE DATOS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
