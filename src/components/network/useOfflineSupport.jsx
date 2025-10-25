import { useState, useEffect, useCallback } from 'react';
import { OfflineStorage } from './OfflineStorage';

export function useOfflineSupport(formKey, initialData = {}) {
  const [formData, setFormData] = useState(initialData);
  const [hasDraft, setHasDraft] = useState(false);

  // Load draft on mount
  useEffect(() => {
    const draft = OfflineStorage.getDraft(formKey);
    if (draft && draft.data) {
      setHasDraft(true);
      // Don't auto-load, let user decide
    }
  }, [formKey]);

  // Auto-save draft periodically
  useEffect(() => {
    if (!formData || Object.keys(formData).length === 0) return;

    const autoSaveInterval = setInterval(() => {
      OfflineStorage.saveDraft(formKey, formData);
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [formKey, formData]);

  const loadDraft = useCallback(() => {
    const draft = OfflineStorage.getDraft(formKey);
    if (draft && draft.data) {
      setFormData(draft.data);
      setHasDraft(false);
      return draft.data;
    }
    return null;
  }, [formKey]);

  const saveDraft = useCallback(() => {
    const success = OfflineStorage.saveDraft(formKey, formData);
    return success;
  }, [formKey, formData]);

  const clearDraft = useCallback(() => {
    const success = OfflineStorage.clearDraft(formKey);
    if (success) {
      setHasDraft(false);
    }
    return success;
  }, [formKey]);

  return {
    formData,
    setFormData,
    hasDraft,
    loadDraft,
    saveDraft,
    clearDraft
  };
}