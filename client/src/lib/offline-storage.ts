const DRAFT_KEY = 'celion_application_drafts';

export interface ApplicationDraft {
  id: string;
  step: number;
  data: {
    applicationType?: string;
    companyType?: string;
    companyName1?: string;
    companyName2?: string;
    companyName3?: string;
    businessDescription?: string;
    registeredAddress?: string;
  };
  updatedAt: string;
  synced: boolean;
}

export function saveDraft(draft: ApplicationDraft): void {
  try {
    const drafts = getDrafts();
    const existingIndex = drafts.findIndex(d => d.id === draft.id);
    
    if (existingIndex >= 0) {
      drafts[existingIndex] = { ...draft, updatedAt: new Date().toISOString(), synced: false };
    } else {
      drafts.push({ ...draft, updatedAt: new Date().toISOString(), synced: false });
    }
    
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
}

export function getDrafts(): ApplicationDraft[] {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getDraft(id: string): ApplicationDraft | undefined {
  return getDrafts().find(d => d.id === id);
}

export function deleteDraft(id: string): void {
  try {
    const drafts = getDrafts().filter(d => d.id !== id);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to delete draft:', error);
  }
}

export function markDraftSynced(id: string): void {
  try {
    const drafts = getDrafts();
    const draft = drafts.find(d => d.id === id);
    if (draft) {
      draft.synced = true;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    }
  } catch (error) {
    console.error('Failed to mark draft synced:', error);
  }
}

export function getUnsyncedDrafts(): ApplicationDraft[] {
  return getDrafts().filter(d => !d.synced);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
