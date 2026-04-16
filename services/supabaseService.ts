import { supabase } from '../lib/supabaseClient';
import { Client, Beneficiary } from '../types';
import { supabaseQueueService } from './syncQueueService';

const MONTH_MAP: Record<string, string> = {
  'Ene': 'ene', 'Feb': 'feb', 'Mar': 'mar', 'Abr': 'abr',
  'May': 'may', 'Jun': 'jun', 'Jul': 'jul', 'Ago': 'ago',
  'Sep': 'sep', 'Oct': 'oct', 'Nov': 'nov', 'Dic': 'dic'
};

const REVERSE_MONTH_MAP: Record<string, string> = {
  'ene': 'Ene', 'feb': 'Feb', 'mar': 'Mar', 'abr': 'Abr',
  'may': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Ago',
  'sep': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'dic': 'Dic'
};

export const supabaseService = {
  /**
   * Obtiene todos los clientes y sus beneficiarios para una sede
   */
  async getSiteClients(siteId: string): Promise<Client[]> {
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

      const clients = (clientsData || []).map(row => {
      const payments: Record<string, number> = {};
      Object.entries(REVERSE_MONTH_MAP).forEach(([dbKey, appKey]) => {
        payments[appKey] = Number(row[dbKey]) || 0;
      });

      const beneficiaries: Beneficiary[] = (row.beneficiaries || []).map((b: any) => ({
        id: b.id,
        numeroContrato: b.contract_number,
        nombre: b.full_name,
        fechaNacimiento: b.birth_date || '',
        estado: b.status || 'ACTIVO'
      }));

      return {
        id: row.id,
        nombre: row.full_name,
        cedula: row.contract_number,
        numeroContrato: row.contract_number,
        telefono: '',
        correo: '',
        valorCompra: 0,
        concepto: 'Mensualidad 2026',
        observaciones: row.observaciones || '',
        payments,
        beneficiaries
      };
      });

      localStorage.setItem(`colillas_cache_site_${siteId}`, JSON.stringify(clients));
      return clients;

    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('Offline')) {
        console.warn(`[Supabase] Cargando caché offline para sede ${siteId}`);
        const cachedData = localStorage.getItem(`colillas_cache_site_${siteId}`);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      }
      throw error;
    }
  },

  /**
   * Crea un nuevo cliente
   */
  async createClient(siteId: string, client: Partial<Client>): Promise<Client> {
    const dbObj: any = {
      site_id: siteId,
      contract_number: String(client.numeroContrato || '').trim(),
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
          cedula: dbObj.contract_number,
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
   * Actualiza un pago mensual
   */
  async updatePayment(clientId: string, month: string, value: number) {
    const dbMonth = MONTH_MAP[month];
    if (!dbMonth) throw new Error(`Mes inválido: ${month}`);

    try {
      const { error } = await supabase
        .from('clients')
        .update({ [dbMonth]: value })
        .eq('id', clientId);

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando pago en cola offline");
        supabaseQueueService.enqueue('updatePayment', clientId, { month: dbMonth, value });
      } else {
        throw error;
      }
    }
  },

  /**
   * Actualiza observaciones
   */
  async updateObservaciones(clientId: string, observations: string) {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ observaciones: observations })
        .eq('id', clientId);

      if (error) throw error;
    } catch (error: any) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        console.warn("[Supabase] Guardando observaciones en cola offline");
        supabaseQueueService.enqueue('updateObservaciones', clientId, { observaciones: observations });
      } else {
        throw error;
      }
    }
  },

  /**
   * Elimina un cliente y sus beneficiarios (cascada en DB)
   */
  async deleteClient(clientId: string) {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

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
      status: beneficiary.estado || 'ACTIVO'
    };

    try {
      const { error } = await supabase
        .from('beneficiaries')
        .insert(dbObj);

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
      const { error } = await supabase
        .from('beneficiaries')
        .delete()
        .eq('contract_number', beneficiaryContrato);

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
      const { error } = await supabase
        .from('beneficiaries')
        .update({ status: status.toUpperCase() })
        .eq('contract_number', beneficiaryContrato);

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
   * Intenta procesar todas las acciones pendientes en la cola de Supabase
   */
  async processQueue() {
    const queue = supabaseQueueService.getQueue();
    if (queue.length === 0) return { processed: 0, total: 0 };
  
    console.log(`[SupabaseSync] Procesando cola de pendientes: ${queue.length} items.`);
    let successCount = 0;
  
    for (const item of queue) {
      try {
        if (item.type === 'updatePayment') {
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
        }
        
        supabaseQueueService.dequeue(item.id);
        successCount++;
        // Pausa breve para evitar saturar el rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch (e: any) {
        console.error(`[SupabaseSync] Falló reintento para ${item.id}`, e);
        supabaseQueueService.incrementRetry(item.id);
        break; // Detenernos si sigue fallando la red
      }
    }
  
    return { processed: successCount, total: queue.length };
  }
};
