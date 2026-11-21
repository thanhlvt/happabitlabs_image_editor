import type {
  CanvasConfig,
  EditorEnvironment,
  Layer,
  ProjectFile,
} from '../types/editor';

const DB_NAME = 'mistcanvas_db';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';
const LEGACY_AUTOSAVE_KEY = 'current_autosave';
const ACTIVE_PROJECT_KEY = 'active_project_id';

export function serializeProject(
  name: string,
  canvas: CanvasConfig,
  layers: Layer[],
  environment?: EditorEnvironment,
  id?: string
): ProjectFile {
  return {
    version: 1,
    ...(id ? { id } : {}),
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
    ...(environment
      ? {
          environment: {
            ...environment,
            panelLayout: { ...environment.panelLayout },
          },
        }
      : {}),
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

  const env =
    obj.environment && typeof obj.environment === 'object'
      ? (obj.environment as EditorEnvironment)
      : undefined;

  return {
    version: 1,
    ...(typeof obj.id === 'string' && obj.id.trim() ? { id: obj.id } : {}),
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Imported Project',
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    canvas: {
      width: Math.round(canvas.width),
      height: Math.round(canvas.height),
      backgroundColor:
        typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : null,
    },
    layers: obj.layers as Layer[],
    ...(env ? { environment: env } : {}),
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
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
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
  const projectKey = project.id || LEGACY_AUTOSAVE_KEY;
  const record: ProjectFile = { ...project, id: projectKey };
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(record, projectKey);
      tx.objectStore(STORE_META).put(projectKey, ACTIVE_PROJECT_KEY);
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
      const tx = db.transaction([STORE_PROJECTS, STORE_META], 'readonly');
      const metaStore = tx.objectStore(STORE_META);
      const projStore = tx.objectStore(STORE_PROJECTS);
      const activeReq = metaStore.get(ACTIVE_PROJECT_KEY);

      activeReq.onsuccess = () => {
        const activeId = (activeReq.result as string | undefined) || LEGACY_AUTOSAVE_KEY;
        const projReq = projStore.get(activeId);
        projReq.onsuccess = () => {
          db.close();
          const res = projReq.result as ProjectFile | undefined;
          if (res && res.canvas && Array.isArray(res.layers)) {
            resolve({ ...res, id: res.id || activeId });
          } else {
            resolve(null);
          }
        };
        projReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      activeReq.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function listSavedProjects(): Promise<ProjectFile[]> {
  const db = await openProjectDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();

      tx.oncomplete = () => {
        db.close();
        const keys = keysReq.result ?? [];
        const vals = (valsReq.result ?? []) as ProjectFile[];
        const items: ProjectFile[] = [];
        for (let i = 0; i < vals.length; i++) {
          const item = vals[i];
          if (item && item.canvas && Array.isArray(item.layers)) {
            items.push({
              ...item,
              id: item.id || String(keys[i]),
            });
          }
        }
        items.sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        resolve(items);
      };
      tx.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function deleteSavedProject(id: string): Promise<boolean> {
  const db = await openProjectDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(id);
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
