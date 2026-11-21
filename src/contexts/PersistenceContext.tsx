import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type SyncStatus = 'synced' | 'syncing' | 'error';

interface PersistenceContextType {
  syncStatus: SyncStatus;
  isDirty: boolean;
  setSyncStatus: (status: SyncStatus) => void;
  setIsDirty: (dirty: boolean) => void;
  triggerGlobalSave: () => void;
  onGlobalSave: (callback: () => Promise<void>) => () => void;
}

const PersistenceContext = createContext<PersistenceContextType | undefined>(undefined);

export function PersistenceProvider({ children }: { children: React.ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isDirty, setIsDirty] = useState(false);
  const saveCallbacks = React.useRef<Set<() => Promise<void>>>(new Set());

  const triggerGlobalSave = useCallback(async () => {
    if (saveCallbacks.current.size === 0) return;
    
    setSyncStatus('syncing');
    try {
      const promises: Promise<void>[] = [];
      saveCallbacks.current.forEach(cb => {
        promises.push(cb());
      });
      await Promise.all(promises);
      setSyncStatus('synced');
      setIsDirty(false);
    } catch (err) {
      console.error("Global save failed:", err);
      setSyncStatus('error');
    }
  }, []);

  const onGlobalSave = useCallback((callback: () => Promise<void>) => {
    saveCallbacks.current.add(callback);
    return () => {
      saveCallbacks.current.delete(callback);
    };
  }, []);

  return (
    <PersistenceContext.Provider value={{ 
      syncStatus, 
      isDirty, 
      setSyncStatus, 
      setIsDirty, 
      triggerGlobalSave,
      onGlobalSave
    }}>
      {children}
    </PersistenceContext.Provider>
  );
}

export function usePersistence() {
  const context = useContext(PersistenceContext);
  if (context === undefined) {
    throw new Error('usePersistence must be used within a PersistenceProvider');
  }
  return context;
}
