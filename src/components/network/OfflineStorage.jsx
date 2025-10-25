// Utility for managing offline data storage
export const OfflineStorage = {
  // Save draft data for a specific form
  saveDraft: (key, data) => {
    try {
      const draft = {
        data,
        timestamp: new Date().toISOString(),
        id: key
      };
      localStorage.setItem(`draft_${key}`, JSON.stringify(draft));
      return true;
    } catch (error) {
      console.error('Error saving draft:', error);
      return false;
    }
  },

  // Get draft data
  getDraft: (key) => {
    try {
      const draft = localStorage.getItem(`draft_${key}`);
      if (draft) {
        return JSON.parse(draft);
      }
      return null;
    } catch (error) {
      console.error('Error getting draft:', error);
      return null;
    }
  },

  // Clear draft after successful submission
  clearDraft: (key) => {
    try {
      localStorage.removeItem(`draft_${key}`);
      return true;
    } catch (error) {
      console.error('Error clearing draft:', error);
      return false;
    }
  },

  // Get all drafts
  getAllDrafts: () => {
    try {
      const drafts = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('draft_')) {
          const draft = localStorage.getItem(key);
          if (draft) {
            drafts.push(JSON.parse(draft));
          }
        }
      }
      return drafts;
    } catch (error) {
      console.error('Error getting all drafts:', error);
      return [];
    }
  },

  // Queue failed operations for retry
  queueOperation: (operation) => {
    try {
      const queue = JSON.parse(localStorage.getItem('operation_queue') || '[]');
      queue.push({
        ...operation,
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0
      });
      localStorage.setItem('operation_queue', JSON.stringify(queue));
      return true;
    } catch (error) {
      console.error('Error queuing operation:', error);
      return false;
    }
  },

  // Get pending operations
  getPendingOperations: () => {
    try {
      return JSON.parse(localStorage.getItem('operation_queue') || '[]');
    } catch (error) {
      console.error('Error getting pending operations:', error);
      return [];
    }
  },

  // Remove operation from queue
  removeOperation: (operationId) => {
    try {
      const queue = JSON.parse(localStorage.getItem('operation_queue') || '[]');
      const filtered = queue.filter(op => op.id !== operationId);
      localStorage.setItem('operation_queue', JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error removing operation:', error);
      return false;
    }
  },

  // Update operation retry count
  incrementRetryCount: (operationId) => {
    try {
      const queue = JSON.parse(localStorage.getItem('operation_queue') || '[]');
      const updated = queue.map(op => 
        op.id === operationId 
          ? { ...op, retryCount: (op.retryCount || 0) + 1, lastRetry: new Date().toISOString() }
          : op
      );
      localStorage.setItem('operation_queue', JSON.stringify(updated));
      return true;
    } catch (error) {
      console.error('Error updating retry count:', error);
      return false;
    }
  }
};