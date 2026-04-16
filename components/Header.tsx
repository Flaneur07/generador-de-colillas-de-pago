import React, { useState, useEffect } from 'react';
import { BarChart3, UserPlus, LogOut, DownloadCloud } from 'lucide-react';
import { LOGO_BASE64 } from '../assets/logo';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import packageJson from '../package.json';

// Detectar si estamos en Electron para usar IPC
const isElectron = typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer';
const ipcRenderer = isElectron ? (window as any).require('electron').ipcRenderer : null;

interface HeaderProps {
  siteName: string;
  onOpenReports: () => void;
  onNewClient: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ siteName, onOpenReports, onNewClient, onLogout }) => {
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const currentVersion = packageJson.version;

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.on('update-available', (_: any, version: string) => {
        setUpdateVersion(version);
      });
      ipcRenderer.on('update-progress', (_: any, percent: number) => {
        setDownloadProgress(Math.round(percent));
      });
    }
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
      {/* Barra de progreso de actualización sutil */}
      {downloadProgress !== null && (
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 overflow-hidden z-50">
          <div 
            className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
            style={{ width: `${downloadProgress}%` }}
          />
          <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-b-md shadow-sm border border-t-0 border-blue-500 flex items-center gap-1">
            <DownloadCloud className="h-2 w-2 animate-bounce" />
            DESCARGANDO VERSIÓN {updateVersion || ''}: {downloadProgress}%
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={LOGO_BASE64} alt="Logo La Fe" className="h-14 w-auto object-contain" />
          <div>
            <div className="flex items-baseline gap-2">
               <h1 className="text-xl font-bold text-slate-900 leading-none">Gestión La Fe</h1>
               {downloadProgress === null && currentVersion && (
                 <span className="text-[10px] font-bold text-slate-400">v{currentVersion}</span>
               )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
                SEDE {siteName.toUpperCase()}
              </span>
            </div>
          </div>
        </div>


        <div className="flex items-center gap-4">
          <SyncStatusIndicator />
          <div className="h-6 w-[1px] bg-slate-200 hidden md:block mx-1"></div>
          
          <button
            onClick={onNewClient}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline">Nuevo Cliente</span>
          </button>

          <button
            onClick={onOpenReports}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-all border border-slate-200"
          >
            <BarChart3 className="h-4 w-4" />
            Reportes
          </button>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
            title="Cerrar Sede"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
