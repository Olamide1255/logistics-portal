import { supabase } from './supabase';

const QUEUE_KEY = 'pending_shipment_comments';
const MAX_QUEUE_SIZE = 100;

type QueuedComment = {
  id: string;
  table: 'shipment_comments';
  action: 'INSERT';
  payload: {
    id: string;
    shipment_id: string;
    comment_text: string;
    updated_by_role?: string;
    action_by_name?: string;
  };
  timestamp: number;
};

type QueueResult = { processed: number; pending: number; discarded: number };

let processingQueue: Promise<QueueResult> | null = null;

function userQueueKey(userId: string) {
  return `${QUEUE_KEY}:${userId}`;
}

function readQueue(key: string): QueuedComment[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedComment[];
  } catch {
    return [];
  }
}

// Offline comments are isolated by authenticated user and cannot enqueue
// arbitrary table names or write operations.
export const queueAction = async (
  table: string,
  action: 'INSERT',
  payload: Omit<QueuedComment['payload'], 'id'>,
) => {
  if (table !== 'shipment_comments' || action !== 'INSERT') {
    throw new Error('This action is not supported by the offline queue.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Sign in again before saving an offline comment.');

  const key = userQueueKey(userId);
  const queue = readQueue(key);
  if (queue.length >= MAX_QUEUE_SIZE) {
    throw new Error('Your offline comment queue is full. Reconnect and sync before adding more.');
  }

  const id = crypto.randomUUID();
  queue.push({
    id,
    table: 'shipment_comments',
    action: 'INSERT',
    payload: { ...payload, id },
    timestamp: Date.now(),
  });
  localStorage.setItem(key, JSON.stringify(queue));
  return id;
};

async function runQueue(): Promise<QueueResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof window === 'undefined') {
    return { processed: 0, pending: 0, discarded: 0 };
  }

  const key = userQueueKey(userId);
  const queue = readQueue(key);
  if (queue.length === 0) return { processed: 0, pending: 0, discarded: 0 };

  const remaining: QueuedComment[] = [];
  let processed = 0;
  let discarded = 0;

  for (const item of queue) {
    if (
      item?.table !== 'shipment_comments' ||
      item?.action !== 'INSERT' ||
      !item?.payload?.id ||
      !item?.payload?.shipment_id ||
      typeof item?.payload?.comment_text !== 'string'
    ) {
      discarded += 1;
      continue;
    }

    try {
      // A response may be lost after the server commits. Checking the client
      // generated ID first makes retrying the same queued comment idempotent.
      const { data: existing, error: lookupError } = await supabase
        .from('shipment_comments')
        .select('id')
        .eq('id', item.payload.id)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (!existing) {
        const { error } = await supabase
          .from('shipment_comments')
          .insert([item.payload]);
        if (error) throw error;
      }
      processed += 1;
    } catch (error) {
      console.error('Offline shipment comment sync failed:', error);
      remaining.push(item);
    }
  }

  localStorage.setItem(key, JSON.stringify(remaining));
  return { processed, pending: remaining.length, discarded };
}

export const processQueue = (): Promise<QueueResult> => {
  if (processingQueue) return processingQueue;
  processingQueue = runQueue().finally(() => {
    processingQueue = null;
  });
  return processingQueue;
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void processQueue();
  });
}
