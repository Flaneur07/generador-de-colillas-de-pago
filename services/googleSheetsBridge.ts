
export interface CloudActionParams {
  action: 'update' | 'create' | 'delete' | 'add_beneficiary' | 'delete_beneficiary' | 'toggle_beneficiary';
  poliza: string | number;
  nombre?: string;
  month?: string;
  value?: number;
  observaciones?: string;
  fechaNacimiento?: string;
  estado?: string;
  beneficiarioContrato?: string;
}

export const syncActionWithCloud = async (scriptUrl: string, params: CloudActionParams) => {
  if (!scriptUrl || !scriptUrl.startsWith('http')) {
    throw new Error("La URL del Script no es válida. Configúrala en el icono de engranaje.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const payload = {
      ...params,
      poliza: String(params.poliza).trim(),
      timestamp: new Date().toISOString()
    };

    console.log(`[CloudSync] Intentando acción: ${params.action} para Póliza: ${params.poliza}`);

    // Usamos mode: 'no-cors' para evitar problemas de CORS con Google Apps Script,
    // pero enviamos como text/plain para que Google lo acepte sin pre-flight.
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Con no-cors no podemos leer la respuesta, pero si no lanza error, el paquete salió.
    return { success: true };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[CloudSync Error]", error);
    if (error.name === 'AbortError') {
      throw new Error("La conexión tardó demasiado. Verifica tu internet.");
    }
    throw new Error("Error de conexión: No se pudo alcanzar el servidor de Google.");
  }
};

export const updatePaymentInCloud = async (scriptUrl: string, params: { poliza: string | number, month?: string, value?: number, observaciones?: string }) => {
  return syncActionWithCloud(scriptUrl, {
    action: 'update',
    poliza: params.poliza,
    month: params.month,
    value: params.value,
    observaciones: params.observaciones
  });
};
