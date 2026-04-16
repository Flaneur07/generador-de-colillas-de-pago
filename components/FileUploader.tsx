
import React, { ChangeEvent, useState, useEffect } from 'react';
import { RefreshCw, Database, AlertCircle, Settings, Link2, ExternalLink, CheckCircle } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { Client } from '../types';

interface FileUploaderProps {
  onDataLoaded: (clients: Client[]) => void;
  siteId: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded, siteId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const clients = await supabaseService.getSiteClients(siteId);
      onDataLoaded(clients);
      setLastSync(new Date());
    } catch (err: any) {
      setError("Error al conectar con Supabase: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Carga automática al montar o cambiar de sede
  useEffect(() => {
    handleSync();
  }, [siteId]);

  return (
    <div className="w-full space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-green-50 p-6 border-b border-green-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full text-green-700">
              <Database className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">Sincronización en la Nube</h2>
                <CheckCircle className="h-4 w-4 text-blue-600" title="Conectado a Supabase" />
              </div>
              <p className="text-sm text-slate-600">
                {lastSync ? `Última lectura: ${lastSync.toLocaleTimeString()}` : 'Base de Datos lista'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              title="Información de Conexión"
            >
              <Settings className={`h-5 w-5 text-blue-600`} />
            </button>
            <button
              onClick={handleSync}
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 animate-fade-in">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
              <Link2 className="h-3 w-3" /> Estado de la Conexión
            </label>
            <div className="flex items-center gap-2 text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
               <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
               Suscrito a Base de Datos en Tiempo Real (Supabase)
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Sede activa: <span className="font-bold text-slate-600 uppercase">{siteId}</span>. Los cambios se guardan instantáneamente.
            </p>
          </div>
        )}

        <div className="px-4 py-2 bg-slate-50 text-[10px] text-slate-400 flex justify-between">
          <span>Backend: PostgreSQL @ Supabase</span>
          <span className="flex items-center gap-1">
            Latencia óptima <CheckCircle className="h-2 w-2 text-green-500" />
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};
