/**
 * Offline Event Queue Service
 * Queues unsent telemetry and verification events during network drops and syncs on reconnect.
 */

class OfflineQueueService {
  constructor() {
    this.queue = [];
    this.STORAGE_KEY = 'gc_offline_event_queue';
    this.isSyncing = false;

    this.loadFromStorage();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncPendingEvents();
      });
    }
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      this.queue = [];
    }
  }

  saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue.slice(-200)));
    } catch (e) {}
  }

  /**
   * Enqueue unsent payload
   */
  enqueue(endpoint, payload) {
    const item = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      endpoint,
      payload,
      timestamp: Date.now(),
    };
    this.queue.push(item);
    this.saveToStorage();
    return item.id;
  }

  /**
   * Sync all pending items with backend
   */
  async syncPendingEvents(apiRunner) {
    if (this.isSyncing || this.queue.length === 0 || !navigator.onLine) return;
    this.isSyncing = true;

    const remaining = [];
    for (const item of this.queue) {
      try {
        if (apiRunner) {
          await apiRunner(item.endpoint, item.payload);
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    this.queue = remaining;
    this.saveToStorage();
    this.isSyncing = false;
  }

  getPendingCount() {
    return this.queue.length;
  }
}

export const offlineQueueService = new OfflineQueueService();
export default offlineQueueService;
