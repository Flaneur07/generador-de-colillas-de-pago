
import React, { useState, useEffect } from 'react';
import { X, User, Calendar, FileText, DollarSign, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Trash2, ShieldCheck } from 'lucide-react';
import { Client } from '../types';
import { updatePaymentInCloud, syncActionWithCloud } from '../services/googleSheetsBridge';

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (updatedClient: Client) => void;
  onDelete?: (clientId: string) => void;
  appScriptUrl: string;
  siteId?: string;
}

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DELETE_CODE = "LAFE-SEG-2026";

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  isOpen,
  onClose,
  client,
  onSave,
  onDelete,
  appScriptUrl,
  siteId
}) => {
  const [formData, setFormData] = useState<Client | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSyncingMonth, setCurrentSyncingMonth] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [modifiedMonths, setModifiedMonths] = useState<Set<string>>(new Set());
  const [isObsModified, setIsObsModified] = useState(false);

  // Beneficiarios
  const [showAddBen, setShowAddBen] = useState(false);
  const [newBen, setNewBen] = useState({ nombre: '', fechaNacimiento: '', estado: 'Activo' });
  const [isProcessingBen, setIsProcessingBen] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationCode, setValidationCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (client && isOpen) {
      setFormData(JSON.parse(JSON.stringify(client)));
      setSyncStatus('idle');
      setErrorMsg('');
      setModifiedMonths(new Set());
      setIsObsModified(false);
      setIsSyncing(false);
      setCurrentSyncingMonth(null);
      setShowDeleteConfirm(false);
      setValidationCode('');
      setShowAddBen(false);
      setNewBen({ nombre: '', fechaNacimiento: '', estado: 'Activo' });
    }
  }, [client, isOpen]);

  if (!isOpen || !formData) return null;

  const scriptUrl = appScriptUrl;

  const handlePaymentChange = (month: string, value: string) => {
    if (!formData) return;
    const numValue = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setModifiedMonths(prev => new Set(prev).add(month));
    setFormData({ ...formData, payments: { ...formData.payments, [month]: numValue } });
    if (syncStatus !== 'idle') setSyncStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    if (!scriptUrl) {
      setSyncStatus('error');
      setErrorMsg("No hay URL de Google Script configurada. Usa el icono de engranaje.");
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      // 1. Sincronizar meses modificados
      if (modifiedMonths.size > 0) {
        for (const month of Array.from(modifiedMonths) as string[]) {
          setCurrentSyncingMonth(month);
          await updatePaymentInCloud(scriptUrl, {
            poliza: formData.numeroContrato,
            month: month,
            value: formData.payments[month] || 0
          });
          await new Promise(r => setTimeout(r, 600));
        }
      }

      // 2. Sincronizar observaciones
      if (isObsModified) {
        setCurrentSyncingMonth("Observaciones");
        await updatePaymentInCloud(scriptUrl, {
          poliza: formData.numeroContrato,
          observaciones: formData.observaciones
        });
      }

      setSyncStatus('success');
      setTimeout(() => {
        onSave(formData);
        onClose();
      }, 1500);
    } catch (err: any) {
      setSyncStatus('error');
      setErrorMsg(err.message || "Error al sincronizar con Excel.");
      setIsSyncing(false);
    }
  };

  const handleToggleBenStatus = async (benIndex: number) => {
    if (!formData || !formData.beneficiaries) return;
    const ben = formData.beneficiaries[benIndex];
    const newStatus = ben.estado === 'Activo' ? 'Inactivo' : 'Activo';
    
    setIsProcessingBen(true);
    try {
      await syncActionWithCloud(scriptUrl, {
        action: 'toggle_beneficiary',
        poliza: formData.numeroContrato,
        beneficiarioContrato: ben.numeroContrato,
        estado: newStatus
      });
      
      const updatedBens = [...formData.beneficiaries];
      updatedBens[benIndex] = { ...ben, estado: newStatus as any };
      setFormData({ ...formData, beneficiaries: updatedBens });
    } catch (err) {
      alert("Error al actualizar estado del beneficiario");
    } finally {
      setIsProcessingBen(false);
    }
  };

  const handleDeleteBen = async (benIndex: number) => {
    if (!formData || !formData.beneficiaries) return;
    if (!confirm("¿Seguro que deseas eliminar este beneficiario?")) return;

    const ben = formData.beneficiaries[benIndex];
    setIsProcessingBen(true);
    try {
      await syncActionWithCloud(scriptUrl, {
        action: 'delete_beneficiary',
        poliza: formData.numeroContrato,
        beneficiarioContrato: ben.numeroContrato
      });
      
      const updatedBens = formData.beneficiaries.filter((_, i) => i !== benIndex);
      setFormData({ ...formData, beneficiaries: updatedBens });
    } catch (err) {
      alert("Error al eliminar beneficiario");
    } finally {
      setIsProcessingBen(false);
    }
  };

  const handleAddBen = async () => {
    if (!formData || !newBen.nombre) return;
    
    setIsProcessingBen(true);
    try {
      // Calcular siguiente numero de contrato
      const baseContrato = String(formData.numeroContrato).split('-')[0];
      const currentBens = formData.beneficiaries || [];
      const suffixes = currentBens.map(b => parseInt(b.numeroContrato.split('-')[1] || '0', 10)).filter(n => !isNaN(n));
      const nextSuffix = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 1;
      const nextContrato = `${baseContrato}-${nextSuffix}`;

      await syncActionWithCloud(scriptUrl, {
        action: 'add_beneficiary',
        poliza: formData.numeroContrato,
        beneficiarioContrato: nextContrato,
        nombre: newBen.nombre,
        fechaNacimiento: newBen.fechaNacimiento,
        estado: newBen.estado
      });

      const newBenObj = {
        id: `ben-new-${Date.now()}`,
        numeroContrato: nextContrato,
        nombre: newBen.nombre,
        fechaNacimiento: newBen.fechaNacimiento,
        estado: newBen.estado as any
      };

      setFormData({
        ...formData,
        beneficiaries: [...(formData.beneficiaries || []), newBenObj]
      });
      setShowAddBen(false);
      setNewBen({ nombre: '', fechaNacimiento: '', estado: 'Activo' });
    } catch (err) {
      alert("Error al agregar beneficiario");
    } finally {
      setIsProcessingBen(false);
    }
  };

  const handleDeleteClient = async () => {
    if (validationCode !== DELETE_CODE) {
      alert("Código de validación incorrecto");
      return;
    }
    if (!scriptUrl) {
      alert("Configura la URL del Script primero");
      return;
    }

    setIsDeleting(true);
    try {
      await syncActionWithCloud(scriptUrl, {
        action: 'delete',
        poliza: formData.numeroContrato
      });
      if (onDelete) onDelete(formData.id);
      onClose();
    } catch (err) {
      alert("Error al eliminar de la nube");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden relative">

        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[60] bg-slate-900/95 flex items-center justify-center p-6 text-white animate-fade-in">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">¿Eliminar Cliente permanentemente?</h3>
                <p className="text-slate-400 text-sm mt-2">Esta acción borrará al cliente <strong>{formData.nombre}</strong> tanto de esta app como del archivo Excel.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Ingresa el código de validación</label>
                <input
                  type="password"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-center text-xl tracking-widest outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteClient}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  CONFIRMAR BORRADO
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-xl">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{formData.nombre}</h2>
              <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">PÓLIZA: {formData.numeroContrato}</span>
            </div>
          </div>
          <button onClick={onClose} disabled={isSyncing} className="p-2 hover:bg-slate-800 rounded-full">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {syncStatus === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-fade-in">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="text-sm font-medium">{errorMsg}</div>
            </div>
          )}

          {syncStatus === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-700 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-sm font-bold">¡Guardado con éxito en la nube!</div>
            </div>
          )}

          <form id="client-form" onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Pagos 2026
                </h3>
                {isSyncing && (
                  <div className="text-[10px] font-bold text-blue-600 flex items-center gap-2 animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> SINCRONIZANDO {currentSyncingMonth}...
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {months.map((month) => (
                  <div key={month} className={`relative p-4 rounded-xl border transition-all ${currentSyncingMonth === month ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : modifiedMonths.has(month) ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-white'}`}>
                    <label className="block text-center text-[11px] font-black mb-2 uppercase text-slate-400">{month}</label>
                    <div className="relative">
                      <DollarSign className={`absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 ${modifiedMonths.has(month) ? 'text-amber-500' : 'text-slate-300'}`} />
                      <input
                        type="text"
                        value={formData.payments[month] || ''}
                        onChange={(e) => handlePaymentChange(month, e.target.value)}
                        disabled={isSyncing}
                        className="w-full pl-5 pr-1 py-1.5 text-right text-base font-bold outline-none bg-transparent disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4" /> Observaciones del Cliente
              </h3>
              <textarea
                value={formData.observaciones || ''}
                onChange={(e) => {
                  setFormData({ ...formData, observaciones: e.target.value });
                  setIsObsModified(true);
                  if (syncStatus !== 'idle') setSyncStatus('idle');
                }}
                rows={3}
                placeholder="Notas adicionales, acuerdos de pago o recordatorios..."
                disabled={isSyncing}
                className="w-full p-4 border border-slate-100 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none"
              />
              <p className="mt-2 text-[10px] text-slate-400 italic">
                Aparecerán en el campo "Observaciones" de la colilla de pago.
              </p>
            </section>

            {siteId === 'heliconia' && (
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Grupo Familiar (Beneficiarios)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddBen(true)}
                    className="flex items-center gap-2 text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all"
                  >
                    AGREGAR BENEFICIARIO
                  </button>
                </div>

                {formData.beneficiaries && formData.beneficiaries.length > 0 ? (
                  <div className="space-y-3">
                    {formData.beneficiaries.map((ben, idx) => (
                      <div key={ben.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${ben.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">{ben.nombre}</p>
                              <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded uppercase">{ben.numeroContrato}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {ben.fechaNacimiento || 'Sin fecha de nacimiento'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBenStatus(idx)}
                            disabled={isProcessingBen}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${ben.estado === 'Activo' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-300 text-slate-600 hover:bg-slate-400'}`}
                          >
                            {ben.estado.toUpperCase()}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBen(idx)}
                            disabled={isProcessingBen}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-sm text-slate-400">No hay beneficiarios registrados para este cotizante.</p>
                  </div>
                )}

                {showAddBen && (
                  <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-fade-in">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase mb-4">Nuevo Beneficiario</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Nombre Completo</label>
                        <input
                          type="text"
                          value={newBen.nombre}
                          onChange={(e) => setNewBen({...newBen, nombre: e.target.value})}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                          placeholder="NOMBRE COMPLETO"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Fecha de Nacimiento</label>
                        <input
                          type="text"
                          value={newBen.fechaNacimiento}
                          onChange={(e) => setNewBen({...newBen, fechaNacimiento: e.target.value})}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                          placeholder="DÍA / MES / AÑO"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowAddBen(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white rounded-lg transition-all"
                      >
                        CANCELAR
                      </button>
                      <button
                        type="button"
                        onClick={handleAddBen}
                        disabled={!newBen.nombre || isProcessingBen}
                        className="px-6 py-2 bg-blue-600 text-white text-xs font-black rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {isProcessingBen && <RefreshCw className="h-3 w-3 animate-spin" />}
                        GUARDAR BENEFICIARIO
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

          </form>
        </div>

        <div className="bg-white border-t border-slate-200 p-6 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSyncing}
            className="flex items-center gap-2 text-red-500 font-bold hover:text-red-700 transition-colors p-2 disabled:opacity-30"
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-sm">Eliminar Cliente</span>
          </button>

          <div className="flex gap-4">
            <button onClick={onClose} disabled={isSyncing} className="px-6 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-100 disabled:opacity-30">Cancelar</button>
            <button
              type="submit"
              form="client-form"
              disabled={isSyncing}
              className={`px-10 py-3 rounded-xl font-black text-white shadow-lg flex items-center gap-2 transition-all ${isSyncing ? 'bg-blue-400 scale-95' : 'bg-green-600 hover:bg-green-700 hover:scale-105 active:scale-95'}`}
            >
              {isSyncing ? <RefreshCw className="h-5 w-5 animate-spin" /> : "GUARDAR EN EXCEL"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
