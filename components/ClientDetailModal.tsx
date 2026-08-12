
import React, { useState, useEffect } from 'react';
import { X, User, Calendar, FileText, DollarSign, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Trash2, ShieldCheck } from 'lucide-react';
import { Client } from '../types';
import { supabaseService, MONTH_MAP } from '../services/supabaseService';

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (updatedClient: Client) => void;
  onDelete?: (clientId: string) => void;
  siteId: string;
}

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DELETE_CODE = "LAFE-SEG-2026";
const BENEFICIARY_STATES = ['ACTIVO', 'FALLECIDO', 'RETIRADA', 'MODIFICACION', 'INACTIVO'];

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  isOpen,
  onClose,
  client,
  onSave,
  onDelete,
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
  const [newBen, setNewBen] = useState({ nombre: '', fechaNacimiento: '', estado: 'ACTIVO', cedula: '' });
  const [isProcessingBen, setIsProcessingBen] = useState(false);
  const [isFetchingBens, setIsFetchingBens] = useState(false);
  const [editingClientCedula, setEditingClientCedula] = useState(false);
  const [tempClientCedula, setTempClientCedula] = useState('');
  const [editingBenCedulaIdx, setEditingBenCedulaIdx] = useState<number | null>(null);
  const [tempBenCedula, setTempBenCedula] = useState('');

  // Editar Perfil Titular
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileNombre, setEditProfileNombre] = useState('');
  const [editProfileCedula, setEditProfileCedula] = useState('');
  const [editProfileFechaNacimiento, setEditProfileFechaNacimiento] = useState('');

  // Editar Beneficiario
  const [editingBenNameIdx, setEditingBenNameIdx] = useState<number | null>(null);
  const [tempBenName, setTempBenName] = useState('');
  const [editingBenBirthIdx, setEditingBenBirthIdx] = useState<number | null>(null);
  const [tempBenBirthDate, setTempBenBirthDate] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationCode, setValidationCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const isInternalUpdate = React.useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isInternalUpdate.current = false;
      return;
    }

    if (client && isOpen) {
      if (isInternalUpdate.current && formData && formData.id === client.id) {
        isInternalUpdate.current = false;
        return;
      }
      isInternalUpdate.current = false;
      const clientCopy: Client = JSON.parse(JSON.stringify(client));
      setFormData(clientCopy);
      setSyncStatus('idle');
      setErrorMsg('');
      setModifiedMonths(new Set());
      setIsObsModified(false);
      setIsSyncing(false);
      setCurrentSyncingMonth(null);
      setShowDeleteConfirm(false);
      setValidationCode('');
      setShowAddBen(false);
      setNewBen({ nombre: '', fechaNacimiento: '', estado: 'INACTIVO', cedula: '' });
      setEditingClientCedula(false);
      setEditingBenCedulaIdx(null);
      setIsEditingProfile(false);
      setEditProfileNombre('');
      setEditProfileCedula('');
      setEditProfileFechaNacimiento('');
      setEditingBenNameIdx(null);
      setTempBenName('');
      setEditingBenBirthIdx(null);
      setTempBenBirthDate('');
      setIsDeleting(false);
    }
  }, [client, isOpen]);

  if (!isOpen || !formData) return null;


  const handlePaymentChange = (month: string, value: string) => {
    if (!formData) return;
    const numValue = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setModifiedMonths(prev => new Set(prev).add(month));
    const payments = formData.payments || {};
    setFormData({ ...formData, payments: { ...payments, [month]: numValue } });
    if (syncStatus !== 'idle') setSyncStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      const updates: Record<string, any> = {};

      // 1. Recolectar meses modificados
      if (modifiedMonths.size > 0) {
        modifiedMonths.forEach(month => {
          const dbMonth = MONTH_MAP[month];
          if (dbMonth) {
            updates[dbMonth] = formData.payments[month] || 0;
          }
        });
      }

      // 2. Recolectar observaciones si cambiaron
      if (isObsModified) {
        updates.observaciones = formData.observaciones || '';
      }

      let finalFormData = { ...formData };

      // Catch unsaved client cedula edit
      if (editingClientCedula && tempClientCedula !== formData.cedula) {
        updates.cedula = tempClientCedula;
        finalFormData.cedula = tempClientCedula;
      }

      // Catch unsaved beneficiary cedula edit
      if (editingBenCedulaIdx !== null && finalFormData.beneficiaries) {
        const ben = finalFormData.beneficiaries[editingBenCedulaIdx];
        if (ben && tempBenCedula !== ben.cedula) {
          await supabaseService.updateBeneficiaryCedula(ben.numeroContrato, tempBenCedula);
          const updatedBens = [...finalFormData.beneficiaries];
          updatedBens[editingBenCedulaIdx] = { ...ben, cedula: tempBenCedula };
          finalFormData.beneficiaries = updatedBens;
        }
      }

      // 3. Enviar todo en una sola petición si hay cambios en el cliente
      if (Object.keys(updates).length > 0) {
        setCurrentSyncingMonth("Datos");
        await supabaseService.updateClient(formData.id, updates);
        
        // Registrar pagos en historial
        for (const month of modifiedMonths) {
          const val = formData.payments[month] || 0;
          await supabaseService.setPaymentHistory(formData.id, siteId, month, val);
        }
      }

      setSyncStatus('success');
      setTimeout(() => {
        onSave(finalFormData);
        onClose();
        setIsSyncing(false);
      }, 1000);
    } catch (err: any) {
      setSyncStatus('error');
      setErrorMsg(err.message || "Error al sincronizar con Supabase.");
      setIsSyncing(false);
    }
  };

  const handleBenStatusChange = async (benIndex: number, newStatus: string) => {
    if (!formData || !formData.beneficiaries) return;
    const ben = formData.beneficiaries[benIndex];
    
    setIsProcessingBen(true);
    try {
      await supabaseService.updateBeneficiaryStatus(ben.numeroContrato, newStatus);
      const updatedBens = [...formData.beneficiaries];
      updatedBens[benIndex] = { ...ben, estado: newStatus };
      const updatedFormData = { ...formData, beneficiaries: updatedBens };
      setFormData(updatedFormData);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
    } catch (err) {
      alert("Error al actualizar estado en Supabase");
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
      await supabaseService.deleteBeneficiary(ben.numeroContrato);
      const updatedBens = formData.beneficiaries.filter((_, i) => i !== benIndex);
      const updatedFormData = { ...formData, beneficiaries: updatedBens };
      setFormData(updatedFormData);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
    } catch (err) {
      alert("Error al eliminar beneficiario de Supabase");
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

      await supabaseService.addBeneficiary(formData.id, {
        numeroContrato: nextContrato,
        nombre: newBen.nombre,
        fechaNacimiento: newBen.fechaNacimiento,
        estado: newBen.estado,
        cedula: newBen.cedula
      });

      const newBenObj = {
        id: `ben-new-${Date.now()}`,
        numeroContrato: nextContrato,
        nombre: newBen.nombre,
        fechaNacimiento: newBen.fechaNacimiento,
        estado: newBen.estado as any,
        cedula: newBen.cedula
      };

      const updatedFormData = {
        ...formData,
        beneficiaries: [...(formData.beneficiaries || []), newBenObj]
      };
      setFormData(updatedFormData);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
      
      setShowAddBen(false);
      setNewBen({ nombre: '', fechaNacimiento: '', estado: 'INACTIVO', cedula: '' });
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

    setIsDeleting(true);
    try {
      await supabaseService.deleteClient(formData.id);
      if (onDelete) onDelete(formData.id);
      onClose();
    } catch (err: any) {
      alert("Error al eliminar de Supabase: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveClientCedula = async () => {
    if (!formData) return;
    try {
      await supabaseService.updateClient(formData.id, { cedula: tempClientCedula });
      const updatedFormData = { ...formData, cedula: tempClientCedula };
      setFormData(updatedFormData);
      setEditingClientCedula(false);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
    } catch (error) {
      alert("Error al guardar la cédula");
    }
  };

  const handleSaveBenCedula = async (benIndex: number) => {
    if (!formData || !formData.beneficiaries) return;
    const ben = formData.beneficiaries[benIndex];
    try {
      await supabaseService.updateBeneficiaryCedula(ben.numeroContrato, tempBenCedula);
      const updatedBens = [...formData.beneficiaries];
      updatedBens[benIndex] = { ...ben, cedula: tempBenCedula };
      const updatedFormData = { ...formData, beneficiaries: updatedBens };
      setFormData(updatedFormData);
      setEditingBenCedulaIdx(null);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
    } catch (error) {
      alert("Error al guardar la cédula del beneficiario");
    }
  };

  const handleSaveBenBirthDate = async (benIndex: number) => {
    if (!formData || !formData.beneficiaries) return;
    const ben = formData.beneficiaries[benIndex];
    const newBirthDate = tempBenBirthDate.trim();
    if (newBirthDate === ben.fechaNacimiento) {
      setEditingBenBirthIdx(null);
      return;
    }
    setIsProcessingBen(true);
    try {
      await supabaseService.updateBeneficiaryBirthDate(ben.numeroContrato, newBirthDate);
      const updatedBens = [...formData.beneficiaries];
      updatedBens[benIndex] = { ...ben, fechaNacimiento: newBirthDate };
      const updatedFormData = { ...formData, beneficiaries: updatedBens };
      setFormData(updatedFormData);
      setEditingBenBirthIdx(null);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
    } catch (error) {
      alert("Error al guardar la fecha de nacimiento del beneficiario");
    } finally {
      setIsProcessingBen(false);
    }
  };

  const handleSaveBenName = async (benIndex: number) => {
    if (!formData || !formData.beneficiaries || !tempBenName.trim()) return;
    const nameUpper = tempBenName.trim().toUpperCase();
    const ben = formData.beneficiaries[benIndex];
    if (nameUpper === ben.nombre) {
      setEditingBenNameIdx(null);
      return;
    }
    setIsProcessingBen(true);
    try {
      await supabaseService.updateBeneficiaryName(ben.numeroContrato, nameUpper);
      const updatedBens = [...formData.beneficiaries];
      updatedBens[benIndex] = { ...ben, nombre: nameUpper };
      const updatedFormData = { ...formData, beneficiaries: updatedBens };
      setFormData(updatedFormData);
      setEditingBenNameIdx(null);
      isInternalUpdate.current = true;
      onSave(updatedFormData);
    } catch (error) {
      alert("Error al guardar el nombre del beneficiario");
    } finally {
      setIsProcessingBen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden relative">

        {isEditingProfile && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in text-slate-800">
              <div className="bg-blue-600 text-white p-5 flex justify-between items-center font-bold">
                <h3 className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Editar Perfil del Cliente
                </h3>
                <button 
                  type="button"
                  onClick={() => setIsEditingProfile(false)} 
                  className="hover:bg-blue-700 p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editProfileNombre.trim()) {
                    alert("El nombre es requerido");
                    return;
                  }
                  setIsProcessingBen(true);
                  try {
                    const nameUpper = editProfileNombre.trim().toUpperCase();
                    const cedulaStr = editProfileCedula.trim();
                    const birthDateStr = editProfileFechaNacimiento.trim();
                    const updates = {
                      full_name: nameUpper,
                      cedula: cedulaStr,
                      birth_date: birthDateStr
                    };
                    await supabaseService.updateClient(formData.id, updates);
                    
                    const updatedFormData = {
                      ...formData,
                      nombre: nameUpper,
                      cedula: cedulaStr,
                      fechaNacimiento: birthDateStr
                    };
                    setFormData(updatedFormData);
                    isInternalUpdate.current = true;
                    onSave(updatedFormData);
                    setIsEditingProfile(false);
                  } catch (error) {
                    alert("Error al actualizar el perfil en Supabase");
                  } finally {
                    setIsProcessingBen(false);
                  }
                }} 
                className="p-6 space-y-5"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre y Apellidos</label>
                  <input
                    type="text"
                    value={editProfileNombre}
                    onChange={(e) => setEditProfileNombre(e.target.value)}
                    required
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cédula</label>
                  <input
                    type="text"
                    value={editProfileCedula}
                    onChange={(e) => setEditProfileCedula(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de Nacimiento</label>
                  <input
                    type="text"
                    value={editProfileFechaNacimiento}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 8) val = val.substring(0, 8);
                      
                      let formatted = val;
                      if (val.length > 2) {
                        formatted = val.substring(0, 2) + '/' + val.substring(2);
                      }
                      if (val.length > 4) {
                        formatted = formatted.substring(0, 5) + '/' + formatted.substring(5);
                      }
                      
                      setEditProfileFechaNacimiento(formatted);
                    }}
                    placeholder="DD/MM/AÑO"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm font-mono text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Número de Póliza</label>
                  <input
                    type="text"
                    value={formData.numeroContrato}
                    disabled
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none font-mono text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all text-center cursor-pointer"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    GUARDAR PERFIL
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

        <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{formData.nombre}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {editingClientCedula ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempClientCedula}
                      onChange={(e) => setTempClientCedula(e.target.value)}
                      placeholder="Número de Cédula"
                      className="px-2 py-0.5 rounded text-xs font-bold font-mono border border-blue-400 outline-none w-32"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveClientCedula()}
                      onBlur={() => {
                        if (tempClientCedula !== formData.cedula) handleSaveClientCedula();
                        else setEditingClientCedula(false);
                      }}
                      autoFocus
                    />
                    <button onMouseDown={(e) => e.preventDefault()} onClick={handleSaveClientCedula} className="text-green-600 hover:text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingClientCedula(false)} className="text-red-500 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  formData.cedula ? (
                    <span 
                      onClick={() => { setTempClientCedula(String(formData.cedula)); setEditingClientCedula(true); }}
                      className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold font-mono border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200 transition-colors"
                      title="Clic para editar"
                    >
                      C.C. {formData.cedula}
                    </span>
                  ) : (
                    <span 
                      onClick={() => { setTempClientCedula(''); setEditingClientCedula(true); }}
                      className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-bold border border-yellow-300 shadow-sm cursor-pointer hover:bg-yellow-200 transition-colors flex items-center gap-1"
                      title="Clic para añadir"
                    >
                      <AlertTriangle className="h-3 w-3" /> Cédula: Pendiente
                    </span>
                  )
                )}
                {formData.fechaNacimiento && (
                  <span className="text-sm font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {formData.fechaNacimiento}
                  </span>
                )}
                <span className="text-sm font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">
                  Póliza N° <strong className="text-slate-800">{formData.numeroContrato}</strong>
                </span>
                {formData.createdAt && (
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Registrado: {new Date(formData.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditProfileNombre(formData.nombre);
                setEditProfileCedula(String(formData.cedula || ''));
                setEditProfileFechaNacimiento(formData.fechaNacimiento || '');
                setIsEditingProfile(true);
              }}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl transition-all border border-slate-200 shadow-sm mr-1 cursor-pointer"
              title="Editar Nombre y Cédula del Titular"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>EDITAR PERFIL</span>
            </button>
            <button onClick={onClose} disabled={isSyncing} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <X className="h-6 w-6 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {syncStatus === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-fade-in">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="text-sm font-medium">{errorMsg}</div>
            </div>
          )}

          {syncStatus === 'success' && (
            <div className={`mb-6 p-4 ${!navigator.onLine ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-green-50 border-green-100 text-green-700'} rounded-xl flex items-center gap-3 animate-fade-in`}>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-sm font-bold">
                {!navigator.onLine 
                  ? 'Sin conexión. Se sincronizará al recuperar internet.' 
                  : '¡Guardado con éxito en la nube!'}
              </div>
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
                        value={formData.payments?.[month] || ''}
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

            {(siteId === 'heliconia' || siteId === 'sevilla' || siteId === 'ebejico') && (
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Grupo Familiar (Beneficiarios)
                    {isFetchingBens && (
                      <span className="ml-2 text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full flex items-center gap-1 animate-pulse uppercase border border-slate-200">
                        <Loader2 className="h-3 w-3 animate-spin" /> CARGANDO...
                      </span>
                    )}
                    {isProcessingBen && (
                      <span className="ml-2 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1 animate-pulse uppercase border border-blue-100">
                        <Loader2 className="h-3 w-3 animate-spin" /> SINCRONIZANDO CON NUBE...
                      </span>
                    )}
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
                          <div className={`p-2 rounded-lg ${
                            (ben.estado || 'ACTIVO').toUpperCase() === 'ACTIVO' ? 'bg-green-100 text-green-700' : 
                            (ben.estado || 'ACTIVO').toUpperCase() === 'FALLECIDO' ? 'bg-gray-800 text-gray-100' :
                            (ben.estado || 'ACTIVO').toUpperCase() === 'MODIFICACION' ? 'bg-amber-100 text-amber-700' :
                            (ben.estado || 'ACTIVO').toUpperCase() === 'RETIRADA' ? 'bg-red-100 text-red-700' :
                            'bg-slate-200 text-slate-500'
                          }`}>
                            <User className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {editingBenNameIdx === idx ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={tempBenName}
                                    onChange={(e) => setTempBenName(e.target.value)}
                                    placeholder="Nombre"
                                    className="px-2 py-0.5 rounded text-xs font-bold border border-blue-400 outline-none w-52 uppercase text-slate-800 bg-white"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveBenName(idx);
                                      if (e.key === 'Escape') setEditingBenNameIdx(null);
                                    }}
                                    onBlur={() => {
                                      if (tempBenName !== ben.nombre) handleSaveBenName(idx);
                                      else setEditingBenNameIdx(null);
                                    }}
                                    autoFocus
                                  />
                                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSaveBenName(idx)} className="text-green-600 hover:text-green-700 cursor-pointer">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingBenNameIdx(null)} className="text-red-500 hover:text-red-600 cursor-pointer">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <p 
                                  onClick={() => { setTempBenName(ben.nombre); setEditingBenNameIdx(idx); }}
                                  className="text-sm font-bold text-slate-800 cursor-pointer hover:bg-slate-200 px-1 rounded transition-colors inline-block"
                                  title="Clic para editar nombre"
                                >
                                  {ben.nombre}
                                </p>
                              )}
                              <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded uppercase">{ben.numeroContrato}</span>
                              
                              {editingBenCedulaIdx === idx ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={tempBenCedula}
                                    onChange={(e) => setTempBenCedula(e.target.value)}
                                    placeholder="Cédula"
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border border-blue-400 outline-none w-24"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveBenCedula(idx)}
                                    onBlur={() => {
                                      if (tempBenCedula !== ben.cedula) handleSaveBenCedula(idx);
                                      else setEditingBenCedulaIdx(null);
                                    }}
                                    autoFocus
                                  />
                                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSaveBenCedula(idx)} className="text-green-600 hover:text-green-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                  </button>
                                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingBenCedulaIdx(null)} className="text-red-500 hover:text-red-600">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                ben.cedula ? (
                                  <span 
                                    onClick={() => { setTempBenCedula(String(ben.cedula)); setEditingBenCedulaIdx(idx); }}
                                    className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200 transition-colors"
                                    title="Clic para editar"
                                  >
                                    C.C. {ben.cedula}
                                  </span>
                                ) : (
                                  <span 
                                    onClick={() => { setTempBenCedula(''); setEditingBenCedulaIdx(idx); }}
                                    className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[9px] font-bold border border-yellow-300 shadow-sm cursor-pointer hover:bg-yellow-200 transition-colors flex items-center gap-1"
                                    title="Clic para añadir"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5" /> Cédula: Pendiente
                                  </span>
                                )
                              )}

                              {ben.createdAt && (
                                <span className="text-[9px] text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded bg-slate-50 flex items-center gap-1">
                                  <Calendar className="h-2.5 w-2.5" /> Registrado: {new Date(ben.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Calendar className="h-3 w-3" />
                                {editingBenBirthIdx === idx ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={tempBenBirthDate}
                                      onChange={(e) => {
                                        let val = e.target.value.replace(/\D/g, '');
                                        if (val.length > 8) val = val.substring(0, 8);
                                        let formatted = val;
                                        if (val.length > 2) {
                                          formatted = val.substring(0, 2) + '/' + val.substring(2);
                                        }
                                        if (val.length > 4) {
                                          formatted = formatted.substring(0, 5) + '/' + formatted.substring(5);
                                        }
                                        setTempBenBirthDate(formatted);
                                      }}
                                      placeholder="DD/MM/AÑO"
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border border-blue-400 outline-none w-20"
                                      onKeyDown={(e) => e.key === 'Enter' && handleSaveBenBirthDate(idx)}
                                      onBlur={() => {
                                        if (tempBenBirthDate !== ben.fechaNacimiento) handleSaveBenBirthDate(idx);
                                        else setEditingBenBirthIdx(null);
                                      }}
                                      autoFocus
                                    />
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSaveBenBirthDate(idx)} className="text-green-600 hover:text-green-700">
                                      <CheckCircle2 className="h-3 w-3" />
                                    </button>
                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingBenBirthIdx(null)} className="text-red-500 hover:text-red-600">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span 
                                    onClick={() => { setTempBenBirthDate(ben.fechaNacimiento || ''); setEditingBenBirthIdx(idx); }}
                                    className="cursor-pointer hover:text-slate-800 hover:bg-slate-200 px-1 rounded transition-colors"
                                    title="Clic para editar"
                                  >
                                    {ben.fechaNacimiento || 'Sin fecha de nacimiento'}
                                  </span>
                                )}
                              </div>
                              {ben.estado === 'INACTIVO' && ben.createdAt && (new Date().getTime() - new Date(ben.createdAt).getTime()) / (1000 * 3600 * 24) >= 90 && (
                                <span className="text-[9px] font-bold text-white bg-red-500 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                  <AlertTriangle className="h-2 w-2" /> ¡ACTIVAR YA! (Han pasado 3 meses)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={ben.estado || 'ACTIVO'}
                            onChange={(e) => handleBenStatusChange(idx, e.target.value)}
                            disabled={isProcessingBen}
                            className={`p-1.5 rounded-lg text-[10px] font-black outline-none border transition-all ${
                              (ben.estado || 'ACTIVO').toUpperCase() === 'ACTIVO' ? 'bg-green-50 border-green-200 text-green-700' : 
                              (ben.estado || 'ACTIVO').toUpperCase() === 'FALLECIDO' ? 'bg-gray-800 border-gray-900 text-white' :
                              (ben.estado || 'ACTIVO').toUpperCase() === 'MODIFICACION' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              (ben.estado || 'ACTIVO').toUpperCase() === 'RETIRADA' ? 'bg-red-50 border-red-200 text-red-700' :
                              'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {BENEFICIARY_STATES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                            {ben.estado && !BENEFICIARY_STATES.includes(ben.estado.toUpperCase()) && (
                              <option value={ben.estado}>{ben.estado.toUpperCase()}</option>
                            )}
                          </select>
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
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 8) val = val.substring(0, 8);
                            
                            let formatted = val;
                            if (val.length > 2) {
                              formatted = val.substring(0, 2) + '/' + val.substring(2);
                            }
                            if (val.length > 4) {
                              formatted = formatted.substring(0, 5) + '/' + formatted.substring(5);
                            }
                            
                            setNewBen({...newBen, fechaNacimiento: formatted});
                          }}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
                          placeholder="DD / MM / AÑO"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cédula (Opcional)</label>
                        <input
                          type="text"
                          value={newBen.cedula}
                          onChange={(e) => setNewBen({...newBen, cedula: e.target.value})}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
                          placeholder="C.C."
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
              {isSyncing ? <RefreshCw className="h-5 w-5 animate-spin" /> : "GUARDAR CAMBIOS"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
