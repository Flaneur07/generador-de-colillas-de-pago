
import React from 'react';
import { FileText, BarChart3, UserPlus, LogOut } from 'lucide-react';

interface HeaderProps {
  siteName: string;
  onOpenReports: () => void;
  onNewClient: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ siteName, onOpenReports, onNewClient, onLogout }) => {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo La Fe" className="h-14 w-auto object-contain" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">Gestión La Fe</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
                SEDE {siteName.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
