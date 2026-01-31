const DB_NAME = "celion-one-offline";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

interface OfflineDraft {
  id: string;
  applicationId: number | null;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("applicationId", "applicationId", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
  });
}

export async function saveDraft(draft: Omit<OfflineDraft, "id" | "createdAt" | "updatedAt" | "synced">): Promise<OfflineDraft> {
  const db = await openDatabase();
  
  const newDraft: OfflineDraft = {
    ...draft,
    id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    synced: false,
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(newDraft);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newDraft);
  });
}

export async function updateDraft(id: string, data: Record<string, unknown>): Promise<OfflineDraft | null> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const draft = getRequest.result as OfflineDraft | undefined;
      if (!draft) {
        resolve(null);
        return;
      }
      
      const updated: OfflineDraft = {
        ...draft,
        data: { ...draft.data, ...data },
        updatedAt: new Date(),
        synced: false,
      };
      
      const putRequest = store.put(updated);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve(updated);
    };
  });
}

export async function getDraft(id: string): Promise<OfflineDraft | null> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getDraftsByApplication(applicationId: number): Promise<OfflineDraft[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("applicationId");
    const request = index.getAll(applicationId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getUnsyncedDrafts(): Promise<OfflineDraft[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allDrafts = request.result as OfflineDraft[];
      resolve(allDrafts.filter(d => !d.synced));
    };
  });
}

export async function markDraftSynced(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const draft = getRequest.result as OfflineDraft | undefined;
      if (!draft) {
        resolve();
        return;
      }
      
      const updated: OfflineDraft = {
        ...draft,
        synced: true,
      };
      
      const putRequest = store.put(updated);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
  });
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllDrafts(): Promise<OfflineDraft[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function syncDrafts(): Promise<{ synced: number; failed: number }> {
  const unsyncedDrafts = await getUnsyncedDrafts();
  let synced = 0;
  let failed = 0;
  
  for (const draft of unsyncedDrafts) {
    try {
      const response = await fetch("/api/drafts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          localId: draft.id,
          applicationId: draft.applicationId ?? undefined,
          data: draft.data,
        }),
      });
      
      if (response.ok) {
        await markDraftSynced(draft.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  
  return { synced, failed };
}

export function useOfflineStatus(): boolean {
  if (typeof window === "undefined") return false;
  return !navigator.onLine;
}
