const LOCAL_SAVE_PREFIX = "frivplus:progress:";
const LOCAL_SAVE_LIMIT_BYTES = 100 * 1024;
const DATABASE_NAME = "frivplus-game-progress";
const DATABASE_VERSION = 1;
const STORE_NAME = "saves";

type StoredSave = {
  gameId: string;
  version: 1;
  updatedAt: string;
  data: unknown;
};

function assertGameId(gameId: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(gameId)) {
    throw new Error("Identificador de jogo inválido.");
  }
}

function openSaveDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB não está disponível neste navegador."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "gameId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento de progresso."));
    request.onblocked = () => reject(new Error("O armazenamento de progresso está ocupado por outra aba."));
  });
}

async function writeIndexedSave(save: StoredSave) {
  const database = await openSaveDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(save);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível salvar o progresso."));
    transaction.onabort = () => reject(transaction.error ?? new Error("O salvamento do progresso foi cancelado."));
  }).finally(() => database.close());
}

async function readIndexedSave(gameId: string): Promise<StoredSave | null> {
  const database = await openSaveDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(gameId);
    request.onsuccess = () => resolve((request.result as StoredSave | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível ler o progresso salvo."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Não foi possível ler o progresso salvo."));
    };
  });
}

async function deleteIndexedSave(gameId: string) {
  const database = await openSaveDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(gameId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível atualizar o armazenamento de progresso."));
    transaction.onabort = () => reject(transaction.error ?? new Error("A atualização do armazenamento foi cancelada."));
  }).finally(() => database.close());
}

export async function saveGameProgress<T>(gameId: string, data: T): Promise<void> {
  assertGameId(gameId);
  const save: StoredSave = {
    gameId,
    version: 1,
    updatedAt: new Date().toISOString(),
    data,
  };
  const serialized = JSON.stringify(save);
  if (serialized === undefined) {
    throw new Error("O progresso do jogo não pode ser serializado.");
  }

  if (new TextEncoder().encode(serialized).byteLength <= LOCAL_SAVE_LIMIT_BYTES) {
    localStorage.setItem(`${LOCAL_SAVE_PREFIX}${gameId}`, serialized);
    if (typeof indexedDB !== "undefined") await deleteIndexedSave(gameId);
    return;
  }

  await writeIndexedSave(save);
  localStorage.removeItem(`${LOCAL_SAVE_PREFIX}${gameId}`);
}

export async function loadGameProgress<T = unknown>(gameId: string): Promise<T | null> {
  assertGameId(gameId);
  const localSave = localStorage.getItem(`${LOCAL_SAVE_PREFIX}${gameId}`);
  if (localSave) {
    const parsed = JSON.parse(localSave) as StoredSave;
    if (parsed.version !== 1 || parsed.gameId !== gameId) {
      throw new Error("O formato do progresso salvo não é compatível.");
    }
    return parsed.data as T;
  }

  const indexedSave = await readIndexedSave(gameId);
  if (!indexedSave) return null;
  if (indexedSave.version !== 1 || indexedSave.gameId !== gameId) {
    throw new Error("O formato do progresso salvo não é compatível.");
  }
  return indexedSave.data as T;
}

export async function deleteGameProgress(gameId: string): Promise<void> {
  assertGameId(gameId);
  localStorage.removeItem(`${LOCAL_SAVE_PREFIX}${gameId}`);
  if (typeof indexedDB !== "undefined") await deleteIndexedSave(gameId);
}

export function createGameProgressAutoSave<T>(
  gameId: string,
  readProgress: () => T,
  delayMs = 800,
) {
  assertGameId(gameId);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
    await saveGameProgress(gameId, readProgress());
  };

  const schedule = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      void flush().catch((error: unknown) => {
        console.error("Não foi possível salvar o progresso do jogo.", error);
      });
    }, delayMs);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void flush().catch((error: unknown) => {
        console.error("Não foi possível salvar o progresso do jogo.", error);
      });
    }
  };
  const onPageHide = () => {
    void flush().catch((error: unknown) => {
      console.error("Não foi possível salvar o progresso do jogo.", error);
    });
  };

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
  }

  return {
    schedule,
    flush,
    dispose() {
      if (timeout) clearTimeout(timeout);
      if (typeof document !== "undefined" && typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
      }
    },
  };
}
