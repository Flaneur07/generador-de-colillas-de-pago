import React, { useState, useEffect } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { SITES, SiteConfig } from '../config/siteConfigs';
import { LOGO_BASE64 } from '../assets/logo';

// Detectar si estamos en Electron para usar IPC
const isElectron = typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer';
const ipcRenderer = isElectron ? (window as any).require('electron').ipcRenderer : null;

interface SiteSelectorProps {
    onSelect: (site: SiteConfig) => void;
}

export const SiteSelector: React.FC<SiteSelectorProps> = ({ onSelect }) => {
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        if (ipcRenderer) {
            ipcRenderer.on('current-version', (_: any, version: string) => {
                setCurrentVersion(version);
            });
        }
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 text-center bg-white p-10 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
                {/* Banner de Versión */}
                {currentVersion && (
                     <div className="absolute top-4 right-4 bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-1 rounded">
                         v{currentVersion}
                     </div>
                )}

                <div className="flex flex-col items-center">
                    <img src={LOGO_BASE64} alt="Logo La Fe" className="h-24 w-auto mb-6 drop-shadow-lg" />
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Bienvenido</h1>
                    <p className="text-slate-500 font-medium">Selecciona una sede para continuar</p>
                </div>

                <div className="grid gap-4">
                    {SITES.map((site) => (
                        <button
                            key={site.id}
                            onClick={() => onSelect(site)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-green-500 hover:shadow-md transition-all group text-left flex items-center justify-between"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{site.name}</h3>
                                    <p className="text-sm text-slate-500">{site.city}</p>
                                </div>
                            </div>
                            <ChevronRight className="text-slate-300 group-hover:text-green-500 transition-colors" />
                        </button>
                    ))}
                </div>

                <div className="text-slate-400 text-xs mt-12">
                    Organización La Fe - Sistema de Gestión de Colillas
                </div>
            </div>
        </div>
    );
};
