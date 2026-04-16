// ─── Cola Supabase Offline ────────────────────────────────────────────────────
export type SupabaseActionType = 'updatePayment' | 'updateObservaciones' | 'createClient' | 'addBeneficiary' | 'deleteBeneficiary' | 'updateBeneficiaryStatus' | 'deleteClient';

export interface PendingSupabaseAction {
  id: string;
  timestamp: string;
  type: SupabaseActionType;
  clientId: string;
  payload: Record<string, any>;
  retryCount: number;
}

const SUPABASE_QUEUE_KEY = 'colillas_supabase_pending';

export const supabaseQueueService = {
  getQueue(): PendingSupabaseAction[] {
    try {
      const data = localStorage.getItem(SUPABASE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("[SupabaseQueue] Error leyendo cola", e);
      return [];
    }
  },

  enqueue(type: SupabaseActionType, clientId: string, payload: Record<string, any>) {
    const queue = this.getQueue();
    const newAction: PendingSupabaseAction = {
      id: `sb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      clientId,
      payload,
      retryCount: 0
    };
    queue.push(newAction);
    localStorage.setItem(SUPABASE_QUEUE_KEY, JSON.stringify(queue));
    console.log(`[SupabaseQueue] Acción encolada offline: ${type} para cliente ${clientId}`);
    return newAction;
  },

  dequeue(id: string) {
    const queue = this.getQueue().filter(a => a.id !== id);
    localStorage.setItem(SUPABASE_QUEUE_KEY, JSON.stringify(queue));
  },

  incrementRetry(id: string) {
    const queue = this.getQueue().map(a => {
      if (a.id === id) return { ...a, retryCount: a.retryCount + 1 };
      return a;
    });
    localStorage.setItem(SUPABASE_QUEUE_KEY, JSON.stringify(queue));
  },

  clear() {
    localStorage.removeItem(SUPABASE_QUEUE_KEY);
  }
};
