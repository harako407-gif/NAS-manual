import type { ManualAsset } from "./manual-types";

const DB_NAME = "synology-manual-media";
const STORE_NAME = "assets";
const PREFERENCES_STORE = "preferences";
const DB_VERSION = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(PREFERENCES_STORE)) {
        database.createObjectStore(PREFERENCES_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("미디어 저장소를 열 수 없습니다."));
  });
}

export async function getPreference<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PREFERENCES_STORE, "readonly");
    const request = transaction.objectStore(PREFERENCES_STORE).get(key);
    request.onsuccess = () => resolve((request.result as { key: string; value: T } | undefined)?.value);
    request.onerror = () => reject(request.error ?? new Error("설정을 불러올 수 없습니다."));
    transaction.oncomplete = () => database.close();
  });
}

export async function putPreference<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PREFERENCES_STORE, "readwrite");
    transaction.objectStore(PREFERENCES_STORE).put({ key, value });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("설정을 저장할 수 없습니다."));
  });
}

export async function deletePreference(key: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PREFERENCES_STORE, "readwrite");
    transaction.objectStore(PREFERENCES_STORE).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("설정을 삭제할 수 없습니다."));
  });
}

export async function getAllAssets(): Promise<ManualAsset[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as ManualAsset[]);
    request.onerror = () => reject(request.error ?? new Error("미디어를 불러올 수 없습니다."));
    transaction.oncomplete = () => database.close();
  });
}

export async function putAsset(asset: ManualAsset): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(asset);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("미디어를 저장할 수 없습니다."));
  });
}

export async function deleteAsset(assetId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(assetId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("미디어를 삭제할 수 없습니다."));
  });
}

export async function replaceAllAssets(assets: ManualAsset[]): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    for (const asset of assets) store.put(asset);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("미디어 복원에 실패했습니다."));
  });
}
