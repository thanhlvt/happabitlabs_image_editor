import type { CanvasConfig, Layer, ProjectFile } from '../types/editor';

const DB_NAME = 'mistcanvas_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = 'current_autosave';

export function serializeProject(
  name: string,
  canvas: CanvasConfig,
  layers: Layer[]
): ProjectFile {
  return {
    version: 1,
    name: name.trim() || 'Untitled Project',
    savedAt: new Date().toISOString(),
    canvas: { ...canvas },
    layers: layers.map((l) =>
      l.type === 'fog'
        ? { ...l, stops: l.stops.map((s) => ({ ...s })) }
        : {
            ...l,
            adjustments: l.adjustments
              ? {
                  ...l.adjustments,
                  colorEdits: l.adjustments.colorEdits.map((c) => ({ ...c })),
                }
              : undefined,
          }
    ),
  };
}

export function parseProjectFile(jsonText: string): ProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('File project không đúng định dạng JSON.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Dữ liệu project không hợp lệ.');
  }

  const obj = raw as Record<string, unknown>;
  const canvas = obj.canvas as Record<string, unknown> | undefined;
  if (
    !canvas ||
    typeof canvas.width !== 'number' ||
    typeof canvas.height !== 'number' ||
    canvas.width <= 0 ||
    canvas.height <= 0
  ) {
    throw new Error('Thông tin kích thước canvas trong file project không hợp lệ.');
  }

  if (!Array.isArray(obj.layers)) {
    throw new Error('Danh sách layer trong file project không hợp lệ.');
  }

  return {
    version: 1,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Imported Project',
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    canvas: {
      width: Math.round(canvas.width),
      height: Math.round(canvas.height),
      backgroundColor:
        typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : null,
    },
    layers: obj.layers as Layer[],
  };
}

export function downloadProjectFile(project: ProjectFile): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeName =
    project.name
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase() || 'project';

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName}.mist.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function openProjectDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveAutoSaveProject(project: ProjectFile): Promise<boolean> {
  const db = await openProjectDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(project, AUTOSAVE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadAutoSaveProject(): Promise<ProjectFile | null> {
  const db = await openProjectDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUTOSAVE_KEY);
      req.onsuccess = () => {
        db.close();
        const res = req.result as ProjectFile | undefined;
        if (res && res.canvas && Array.isArray(res.layers)) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}
