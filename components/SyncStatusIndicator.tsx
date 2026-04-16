
import React, { useState, useEffect, useCallback } from 'react';
import { CloudOff, RefreshCw, CheckCircle2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { supabaseQueueService } from '../services/syncQueueService';
import { supabaseService } from '../services/supabaseService';
import { PendingSyncModal } from './PendingSyncModal';

export const SyncStatusIndicator: React.FC = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showToast, setShowToast] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Memorizar handleSyncNow para usarlo en el useEffect de reconexión
  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    const sbQueue = supabaseQueueService.getQueue();
    if (sbQueue.length === 0) return;

    setIsSyncing(true);
    try {
      const resultSb = await supabaseService.processQueue();
      
      if (resultSb.processed > 0) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (e) {
      console.error("Error en sync", e);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Intentar auto-sync al recuperar internet
      const sbQueue = supabaseQueueService.getQueue();
      if (sbQueue.length > 0) {
        console.log("[Sync] Internet recuperado. Iniciando auto-sincronización...");
        handleSyncNow();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisar la cola periódicamente
    const interval = setInterval(() => {
      const sbQueue = supabaseQueueService.getQueue();
      setPendingCount(sbQueue.length);
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [handleSyncNow]);

  if (pendingCount === 0 && isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100">
        <Wifi className="h-3 w-3" />
        <span className="text-[10px] font-black uppercase tracking-tight">En Línea</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {pendingCount > 0 && (
        <button
          onClick={() => setShowPendingModal(true)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all animate-fade-in ${
            !isOnline 
            ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' 
            : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {isSyncing ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <AlertCircle className="h-3 w-3 group-hover:scale-110 transition-transform" />
          )}
          <span className="text-[10px] font-black uppercase">
            {isSyncing ? 'Sincronizando...' : `${pendingCount} Cambio${pendingCount > 1 ? 's' : ''} Pendiente${pendingCount > 1 ? 's' : ''}`}
          </span>
        </button>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full border border-red-100 animate-pulse">
          <WifiOff className="h-3 w-3" />
          <span className="text-[10px] font-black uppercase tracking-tight">Sin Conexión</span>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-slate-900/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce-in border border-slate-700">
          <div className="bg-green-500/20 p-2 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-bold">Base de datos sincronizada</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Todos los cambios han sido aplicados</p>
          </div>
        </div>
      )}

      <PendingSyncModal 
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        onSync={handleSyncNow}
        isSyncing={isSyncing}
      />
    </div>
  );
};

