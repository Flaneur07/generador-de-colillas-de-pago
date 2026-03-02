
import React, { ChangeEvent, useState, useEffect } from 'react';
import { RefreshCw, Database, AlertCircle, Settings, Link2, ExternalLink, CheckCircle } from 'lucide-react';
import { syncWithGoogleSheets, DEFAULT_SHEET_ID } from '../services/excelService';
import { Client } from '../types';

interface FileUploaderProps {
  onDataLoaded: (clients: Client[]) => void;
  spreadsheetId: string;
  sheetName: string;
  appScriptUrl: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded, spreadsheetId, sheetName, appScriptUrl }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const clients = await syncWithGoogleSheets(spreadsheetId, sheetName);
      onDataLoaded(clients);
      setLastSync(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                {appScriptUrl && <CheckCircle className="h-4 w-4 text-green-600" title="Escritura vinculada" />}
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
              title="Configurar Escritura"
            >
              <Settings className={`h-5 w-5 ${appScriptUrl ? 'text-green-600' : ''}`} />
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
              <Link2 className="h-3 w-3" /> URL de Google Apps Script (Configurada)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={appScriptUrl}
                readOnly
                className="flex-1 p-2 text-sm border border-slate-200 bg-slate-100 rounded-lg text-slate-500 outline-none"
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Esta URL está vinculada a la sede actual y permite guardar cambios en Excel.
            </p>
          </div>
        )}

        <div className="px-4 py-2 bg-slate-50 text-[10px] text-slate-400 flex justify-between">
          <span>Hoja: {sheetName}</span>
          <a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target="_blank" className="flex items-center gap-1 hover:text-blue-600">
            Abrir Excel <ExternalLink className="h-2 w-2" />
          </a>
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
