import { supabase } from '../lib/supabaseClient';
import { Client, Beneficiary } from '../types';
import { supabaseQueueService } from './syncQueueService';

export const MONTH_MAP: Record<string, string> = {
  'Ene': 'ene', 'Feb': 'feb', 'Mar': 'mar', 'Abr': 'abr',
  'May': 'may', 'Jun': 'jun', 'Jul': 'jul', 'Ago': 'ago',
  'Sep': 'sep', 'Oct': 'oct', 'Nov': 'nov', 'Dic': 'dic'
};

const REVERSE_MONTH_MAP: Record<string, string> = {
  'ene': 'Ene', 'feb': 'Feb', 'mar': 'Mar', 'abr': 'Abr',
  'may': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Ago',
  'sep': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'dic': 'Dic'
};

const withTimeout = <T>(promise: PromiseLike<T>, ms: number = 5000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Failed to fetch (timeout)'));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
};

export const supabaseService = {
  async getSiteClients(siteId: string): Promise<Client[]> {
    let clients: Client[] = [];
    try {
      if (!navigator.onLine) {
        throw new Error('Offline (simulado o real)');
      }

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          beneficiaries (*)
        `)
        .eq('site_id', siteId)
        .order('full_name', { ascending: true });

      if (clientsError) throw clientsError;

      clients = (clientsData || []).map(row => {
        const payments: Record<string, number> = {};
        Object.entries(REVERSE_MONTH_MAP).forEach(([dbKey, appKey]) => {
          payments[appKey] = Number(row[dbKey]) || 0;
        });

        const beneficiaries: Beneficiary[] = (row.beneficiaries || []).map((b: any) => ({
          id: b.id,
          numeroContrato: b.contract_number,
          nombre: b.full_name,
          fechaNacimiento: b.birth_date || '',
          estado: b.status || 'INACTIVO',
          createdAt: b.created_at,
          cedula: b.cedula
        }));

        return {
          id: row.id,
          nombre: row.full_name,
          cedula: row.cedula,
          fechaNacimiento: row.birth_date,
          numeroContrato: row.contract_number,
          telefono: '',
          correo: '',
          valorCompra: 0,
          concepto: 'Mensualidad 2026',
          observaciones: row.observaciones || '',
          payments,
          beneficiaries,
          createdAt: row.created_at
        };
      });

      localStorage.setItem(`colillas_cache_site_${siteId}`, JSON.stringify(clients));
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('Offline')) {
        console.warn(`[Supabase] Cargando caché offline para sede ${siteId}`);
        const cachedData = localStorage.getItem(`colillas_cache_site_${siteId}`);
        if (cachedData) {
          clients = JSON.parse(cachedData);
        } else {
          return []; // Nada en caché y sin internet
        }
      } else {
        throw error;
      }
    }

    // ─── LÓGICA DE REPLAY (Optimismo total) ───
    // Aplicamos los cambios que están en la cola pendientes de subir a la nube
    const queue = supabaseQueueService.getQueue();
    if (queue.length === 0) return clients;

    const merged = [...clients];
    
    for (const action of queue) {
      if (action.type === 'updatePayment') {
        const idx = merged.findIndex(c => c.id === action.clientId);
        if (idx !== -1) {
          const appMonth = REVERSE_MONTH_MAP[action.payload.month];
          if (appMonth) merged[idx].payments[appMonth] = action.payload.value;
        }
      } else if (action.type === 'updateObservaciones') {
        const idx = merged.findIndex(c => c.id === action.clientId);
        if (idx !== -1) merged[idx].observaciones = action.payload.observaciones;
      } else if (action.type === 'createClient') {
        const payload = action.payload.client;
        if (!merged.find(c => c.id === action.clientId)) {
          merged.push({
            id: action.clientId,
            nombre: payload.full_name,
            cedula: payload.cedula || '',
            fechaNacimiento: payload.birth_date || '',
            numeroContrato: payload.contract_number,
            telefono: '',
            correo: '',
            valorCompra: 0,
            concepto: 'Mensualidad 2026',
            observaciones: payload.observaciones || '',
            payments: {
              'Ene': 0, 'Feb': 0, 'Mar': 0, 'Abr': 0, 'May': 0, 'Jun': 0,
              'Jul': 0, 'Ago': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Dic': 0
            },
            beneficiaries: []
          } as any);
        }
      } else if (action.type === 'deleteClient') {
        const idx = merged.findIndex(c => c.id === action.clientId);
        if (idx !== -1) merged.splice(idx, 1);
      } else if (action.type === 'addBeneficiary') {
        const client = merged.find(c => c.id === action.clientId);
        if (client) {
          const b = action.payload.beneficiary;
          client.beneficiaries.push({
            id: `temp-${Date.now()}`,
            numeroContrato: b.contract_number,
            nombre: b.full_name,
            fechaNacimiento: b.birth_date,
            estado: b.status,
            createdAt: new Date().toISOString(),
            cedula: b.cedula || ''
          });
        }
      } else if (action.type === 'deleteBeneficiary') {
         merged.forEach(c => {
           c.beneficiaries = c.beneficiaries.filter(b => b.numeroContrato !== action.payload.contract_number);
         });
      } else if (action.type === 'updateBeneficiaryStatus') {
        merged.forEach(c => {
          const b = c.beneficiaries.find(b => b.numeroContrato === action.payload.contract_number);
          if (b) b.estado = action.payload.status;
        });
      } else if (action.type === 'updateBeneficiaryCedula' as any) {
        merged.forEach(c => {
          const b = c.beneficiaries.find(b => b.numeroContrato === action.payload.contract_number);
          if (b) b.cedula = action.payload.cedula;
        });
      } else if (action.type === 'updateBeneficiaryName' as any) {
        merged.forEach(c => {
          const b = c.beneficiaries.find(b => b.numeroContrato === action.payload.contract_number);
          if (b) b.nombre = action.payload.name;
        });
      } else if (action.type === 'updateBeneficiaryBirthDate' as any) {
        merged.forEach(c => {
          const b = c.beneficiaries.find(b => b.numeroContrato === action.payload.contract_number);
          if (b) b.fechaNacimiento = action.payload.birth_date;
        });
      }
    }

    return merged.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  /**
   * Crea un nuevo cliente
   */
  async createClient(siteId: string, client: Partial<Client>): Promise<Client> {
    const dbObj: any = {
      site_id: siteId,
      contract_number: String(client.numeroContrato || '').trim(),
      cedula: String(client.cedula || '').trim(),
      birth_date: client.fechaNacimiento || '',
      full_name: (client.nombre || '').toUpperCase(),
      observaciones: client.observaciones || ''
    };

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert(dbObj)
        .select()
        .single();

      if (error) throw error;
      
      // Devolvemos el cliente mapeado
      return (await this.getSiteClients(siteId)).find(c => c.id === data.id)!;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando creación de cliente en cola offline");
        const tempId = crypto.randomUUID();
        dbObj.id = tempId;
        supabaseQueueService.enqueue('createClient', tempId, { siteId, client: dbObj });
        
        return {
          id: tempId,
          nombre: dbObj.full_name,
          cedula: dbObj.cedula,
          fechaNacimiento: dbObj.birth_date,
          numeroContrato: dbObj.contract_number,
          telefono: '',
          correo: '',
          valorCompra: 0,
          concepto: 'Mensualidad 2026',
          observaciones: dbObj.observaciones,
          payments: {
            'Ene': 0, 'Feb': 0, 'Mar': 0, 'Abr': 0, 'May': 0, 'Jun': 0,
            'Jul': 0, 'Ago': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Dic': 0
          },
          beneficiaries: []
        } as unknown as Client;
      } else {
        throw error;
      }
    }
  },

  /**
   * Actualiza múltiples campos de un cliente (Pagos, Observaciones, etc.) en una sola petición
   */
  async updateClient(clientId: string, updates: Record<string, any>) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('clients')
          .update(updates)
          .eq('id', clientId)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando actualización en cola offline");
        supabaseQueueService.enqueue('updateClient' as any, clientId, { updates });
      } else {
        throw error;
      }
    }
  },

  /**
   * Actualiza un pago mensual (mantenido por compatibilidad)
   */
  async updatePayment(clientId: string, month: string, value: number) {
    const dbMonth = MONTH_MAP[month];
    if (!dbMonth) throw new Error(`Mes inválido: ${month}`);
    return this.updateClient(clientId, { [dbMonth]: value });
  },

  /**
   * Actualiza observaciones
   */
  async updateObservaciones(clientId: string, observations: string) {
    return this.updateClient(clientId, { observaciones: observations });
  },

  /**
   * Elimina un cliente y sus beneficiarios (cascada en DB)
   */
  async deleteClient(clientId: string) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('clients')
          .delete()
          .eq('id', clientId)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando eliminación de cliente en cola offline");
        supabaseQueueService.enqueue('deleteClient', clientId, {});
      } else {
        throw error;
      }
    }
  },

  /**
   * Agrega un beneficiario
   */
  async addBeneficiary(clientId: string, beneficiary: Partial<Beneficiary>) {
    const dbObj = {
      client_id: clientId,
      contract_number: beneficiary.numeroContrato,
      full_name: (beneficiary.nombre || '').toUpperCase(),
      birth_date: beneficiary.fechaNacimiento,
      status: beneficiary.estado || 'INACTIVO',
      cedula: beneficiary.cedula || ''
    };

    try {
      const { error } = await withTimeout(
        supabase
          .from('beneficiaries')
          .insert(dbObj)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando creación de beneficiario en cola offline");
        supabaseQueueService.enqueue('addBeneficiary', clientId, { beneficiary: dbObj });
      } else {
        throw error;
      }
    }
  },

  /**
   * Elimina un beneficiario
   */
  async deleteBeneficiary(beneficiaryContrato: string) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('beneficiaries')
          .delete()
          .eq('contract_number', beneficiaryContrato)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando eliminación de beneficiario en cola offline");
        supabaseQueueService.enqueue('deleteBeneficiary', '', { contract_number: beneficiaryContrato });
      } else {
        throw error;
      }
    }
  },

  /**
   * Cambia el estado de un beneficiario
   */
  async updateBeneficiaryStatus(beneficiaryContrato: string, status: string) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('beneficiaries')
          .update({ status: status.toUpperCase() })
          .eq('contract_number', beneficiaryContrato)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando actualización de estado env cola offline");
        supabaseQueueService.enqueue('updateBeneficiaryStatus', '', { contract_number: beneficiaryContrato, status: status.toUpperCase() });
      } else {
        throw error;
      }
    }
  },

  /**
   * Actualiza la cédula de un beneficiario
   */
  async updateBeneficiaryCedula(beneficiaryContrato: string, cedula: string) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('beneficiaries')
          .update({ cedula: cedula })
          .eq('contract_number', beneficiaryContrato)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando actualización de cédula env cola offline");
        supabaseQueueService.enqueue('updateBeneficiaryCedula' as any, '', { contract_number: beneficiaryContrato, cedula: cedula });
      } else {
        throw error;
      }
    }
  },

  /**
   * Actualiza el nombre de un beneficiario
   */
  async updateBeneficiaryName(beneficiaryContrato: string, name: string) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('beneficiaries')
          .update({ full_name: name.toUpperCase() })
          .eq('contract_number', beneficiaryContrato)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando actualización de nombre en cola offline");
        supabaseQueueService.enqueue('updateBeneficiaryName' as any, '', { contract_number: beneficiaryContrato, name: name.toUpperCase() });
      } else {
        throw error;
      }
    }
  },

  /**
   * Actualiza la fecha de nacimiento de un beneficiario
   */
  async updateBeneficiaryBirthDate(beneficiaryContrato: string, birthDate: string) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('beneficiaries')
          .update({ birth_date: birthDate })
          .eq('contract_number', beneficiaryContrato)
      );

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando actualización de fecha nac. en cola offline");
        supabaseQueueService.enqueue('updateBeneficiaryBirthDate' as any, '', { contract_number: beneficiaryContrato, birth_date: birthDate });
      } else {
        throw error;
      }
    }
  },

  /**
   * Intenta procesar todas las acciones pendientes en la cola de Supabase
   */
  async processQueue() {
    const queue = supabaseQueueService.getQueue();
    if (queue.length === 0) return { processed: 0, total: 0 };
  
    console.log(`[SupabaseSync] Procesando cola de pendientes: ${queue.length} items.`);
    let successCount = 0;
  
    for (const item of queue) {
      try {
        if (item.type === 'updateClient' as any) {
          const { error } = await supabase.from('clients').update(item.payload.updates).eq('id', item.clientId);
          if (error) throw error;
        } else if (item.type === 'updatePayment') {
          const { error } = await supabase.from('clients').update({ [item.payload.month]: item.payload.value }).eq('id', item.clientId);
          if (error) throw error;
        } else if (item.type === 'updateObservaciones') {
          const { error } = await supabase.from('clients').update({ observaciones: item.payload.observaciones }).eq('id', item.clientId);
          if (error) throw error;
        } else if (item.type === 'createClient') {
          const { error } = await supabase.from('clients').insert(item.payload.client);
          if (error) throw error;
        } else if (item.type === 'deleteClient') {
          const { error } = await supabase.from('clients').delete().eq('id', item.clientId);
          if (error) throw error;
        } else if (item.type === 'addBeneficiary') {
          const { error } = await supabase.from('beneficiaries').insert(item.payload.beneficiary);
          if (error) throw error;
        } else if (item.type === 'deleteBeneficiary') {
          const { error } = await supabase.from('beneficiaries').delete().eq('contract_number', item.payload.contract_number);
          if (error) throw error;
        } else if (item.type === 'updateBeneficiaryStatus') {
          const { error } = await supabase.from('beneficiaries').update({ status: item.payload.status }).eq('contract_number', item.payload.contract_number);
          if (error) throw error;
        } else if (item.type === 'updateBeneficiaryCedula' as any) {
          const { error } = await supabase.from('beneficiaries').update({ cedula: item.payload.cedula }).eq('contract_number', item.payload.contract_number);
          if (error) throw error;
        } else if (item.type === 'updateBeneficiaryName' as any) {
          const { error } = await supabase.from('beneficiaries').update({ full_name: item.payload.name }).eq('contract_number', item.payload.contract_number);
          if (error) throw error;
        } else if (item.type === 'updateBeneficiaryBirthDate' as any) {
          const { error } = await supabase.from('beneficiaries').update({ birth_date: item.payload.birth_date }).eq('contract_number', item.payload.contract_number);
          if (error) throw error;
        } else if (item.type === 'setPaymentHistory' as any) {
          await supabase.from('payment_history').delete().eq('client_id', item.clientId).eq('month', item.payload.month);
          if (item.payload.amount > 0) {
            const { error } = await supabase.from('payment_history').insert({
              client_id: item.clientId,
              site_id: item.payload.siteId,
              month: item.payload.month,
              amount: item.payload.amount
            });
            if (error) throw error;
          }
        }
        
        successCount++;
        supabaseQueueService.dequeue(item.id);
        // Pausa breve para evitar saturar el rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch (e: any) {
        console.error(`[SupabaseSync] Falló reintento para ${item.id}`, e);
        supabaseQueueService.incrementRetry(item.id);
        break; // Detenernos si sigue fallando la red
      }
    }
  
    return { processed: successCount, total: queue.length };
  },

  /**
   * Actualiza o elimina el historial de un pago (si es 0 se borra para que no salga en el reporte diario)
   */
  async setPaymentHistory(clientId: string, siteId: string, month: string, amount: number) {
    try {
      // Siempre borramos el registro anterior para este mes y cliente para evitar duplicados o para limpiar si el pago bajó a 0
      await withTimeout(
        supabase.from('payment_history')
          .delete()
          .eq('client_id', clientId)
          .eq('month', month)
      );

      if (amount <= 0) return; // Si es 0, ya lo borramos, no hacemos insert
      
      const payload = {
        client_id: clientId,
        site_id: siteId,
        month,
        amount
      };

      const { error } = await withTimeout(
        supabase.from('payment_history').insert(payload)
      );
      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando actualización de historial en cola offline");
        supabaseQueueService.enqueue('setPaymentHistory' as any, clientId, { siteId, month, amount });
      } else {
        throw error;
      }
    }
  },

  /**
   * Obtiene los pagos realizados en un día específico
   */
  async getDailyPayments(siteId: string, dateStr: string) {
    if (!navigator.onLine) {
      console.warn("Offline: No se puede obtener reporte diario.");
      return [];
    }
    
    // dateStr format: YYYY-MM-DD
    const startOfDay = `${dateStr}T00:00:00Z`;
    const endOfDay = `${dateStr}T23:59:59Z`;

    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('site_id', siteId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (error) {
      console.error("Error obteniendo pagos diarios:", error);
      return [];
    }
    return data || [];
  }
};
