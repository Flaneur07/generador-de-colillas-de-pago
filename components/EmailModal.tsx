import React, { useState, useEffect } from 'react';
import { Mail, X, Settings, Send, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { Client } from '../types';
import { initTokenClient, requestAccessToken, sendGmail } from '../services/gmailService';
import { getPaymentSlipBase64 } from '../services/pdfService';

import { SiteConfig } from '../config/siteConfigs';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  selectedValue: number;
  selectedMonth: string;
  siteConfig: SiteConfig;
  receiptNumber: string;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  client,
  selectedValue,
  selectedMonth,
  siteConfig,
  receiptNumber
}) => {
  const [step, setStep] = useState<'config' | 'compose' | 'sending' | 'success'>('compose');
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load saved configuration on mount
  useEffect(() => {
    const savedClientId = localStorage.getItem('google_client_id');
    if (savedClientId) {
      setClientId(savedClientId);
      // Initialize immediately if we have a client ID
      initTokenClient(savedClientId, (token) => {
        setAccessToken(token);
        setError(null);
      });
    } else {
      setStep('config');
    }
  }, []);

  // Pre-fill email data when modal opens
  useEffect(() => {
    if (isOpen && client) {
      setToEmail(client.correo || '');
      setSubject(`Comprobante de Pago - ${client.nombre} - ${selectedMonth} 2026`);
    }
  }, [isOpen, client, selectedMonth]);

  const handleSaveConfig = () => {
    if (!clientId.trim()) {
      setError("Por favor ingresa un Client ID válido.");
      return;
    }
    localStorage.setItem('google_client_id', clientId);
    try {
      initTokenClient(clientId, (token) => {
        setAccessToken(token);
        setError(null);
      });
      setStep('compose');
      setError(null);
    } catch (e) {
      setError("Error al inicializar Google Auth. Verifica la consola.");
    }
  };

  const handleSend = async () => {
    if (!toEmail.trim()) {
      setError("El correo del destinatario es obligatorio.");
      return;
    }

    // If we don't have a token yet, trigger the popup
    if (!accessToken) {
      try {
        requestAccessToken();
        // We need to wait for the callback (defined in initTokenClient) to set the token.
        // For simplicity, we ask the user to click send again after auth, or we could handle promise state.
        setError("Autenticación requerida. Por favor inicia sesión en la ventana emergente y luego presiona Enviar nuevamente.");
        return;
      } catch (e: any) {
        setError(e.message);
        return;
      }
    }

    setStep('sending');
    setError(null);

    try {
      // 1. Generate PDF
      const tempClient = { ...client, valorCompra: selectedValue, concepto: `Mensualidad ${selectedMonth} 2026` };
      const pdfBase64 = await getPaymentSlipBase64(tempClient, siteConfig, receiptNumber);

      // 2. Body
      const body = `Hola ${client.nombre},\n\nAdjunto encontrarás tu comprobante de pago correspondiente a la mensualidad de ${selectedMonth} 2026.\n\nValor pagado: $${selectedValue.toLocaleString()}\n\nGracias por tu pago.\n\nAtentamente,\n${siteConfig.orgName}`;

      // 3. Send via Gmail API
      await sendGmail(accessToken, toEmail, subject, body, pdfBase64);

      setStep('success');
      setTimeout(() => {
        onClose();
        setStep('compose'); // Reset for next time
      }, 3000);

    } catch (err: any) {
      setStep('compose');
      setError("Error al enviar: " + err.message);
      // If token expired (401), we might need to clear it
      if (err.message.includes("401") || err.message.includes("Invalid Credentials")) {
        setAccessToken(null);
        setError("La sesión expiró. Por favor intenta enviar nuevamente para reconectar.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Comprobante
          </h3>
          <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">

          {step === 'config' && (
            <div className="space-y-4">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex gap-3">
                <Settings className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Configuración Inicial</p>
                  <p>Para enviar correos desde tu cuenta, necesitas un <strong>Google Client ID</strong>.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Google Cloud Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxxxxxx.apps.googleusercontent.com"
                  className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Este dato se guardará en tu navegador.</p>
              </div>
              <button
                onClick={handleSaveConfig}
                className="w-full bg-slate-800 text-white py-2 rounded font-medium hover:bg-slate-900 transition-colors"
              >
                Guardar y Continuar
              </button>
            </div>
          )}

          {step === 'compose' && (
            <div className="space-y-4">
              {!accessToken && (
                <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Se requerirá inicio de sesión al enviar.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Destinatario</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="cliente@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs text-slate-500">
                <p className="font-semibold mb-1">Archivo Adjunto:</p>
                <p>Recibo_Caja_{client.nombre.split(' ')[0]}.pdf</p>
              </div>

              <button
                onClick={handleSend}
                className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar Correo Real
              </button>

              <button
                onClick={() => setStep('config')}
                className="w-full text-slate-400 text-xs hover:text-slate-600 mt-2"
              >
                Cambiar configuración de API
              </button>
            </div>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-slate-600 font-medium">Enviando correo a través de Gmail...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 text-green-600 animate-fade-in">
              <CheckCircle className="h-16 w-16" />
              <p className="font-bold text-lg">¡Correo Enviado!</p>
              <p className="text-sm text-slate-500">El recibo ha sido enviado correctamente.</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};