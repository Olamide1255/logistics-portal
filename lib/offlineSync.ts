// lib/offlineSync.ts
import { supabase } from './supabase';

const QUEUE_KEY = 'pending_db_actions';

// Add a failed action to local storage
export const queueAction = (table: string, action: 'INSERT' | 'UPDATE', payload: any) => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ id: crypto.randomUUID(), table, action, payload, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// Process the queue when internet is back
export const processQueue = async () => {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  const remainingQueue = [];

  for (const item of queue) {
    try {
      if (item.action === 'INSERT') {
        const { error } = await supabase.from(item.table).insert([item.payload]);
        if (error) throw error;
      } else if (item.action === 'UPDATE') {
        const { error } = await supabase.from(item.table).update(item.payload.data).eq('id', item.payload.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Sync failed for item:', item, err);
      remainingQueue.push(item); // Keep in queue if still failing
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
};

// Listen for network changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online! Processing offline queue...');
    processQueue();
  });
}