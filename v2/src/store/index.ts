/**
 * Store Module
 * 
 * Handles all data persistence - payloads, settings, URL sharing.
 */

export {
  presets,
  loadPayloads,
  savePayloads,
  getPayload,
  createPayload,
  updatePayload,
  deletePayload,
  forkPreset,
  exportPayloads,
  importPayloads,
  loadSettings,
  saveSettings,
  defaultSettings,
  loadDrafts,
  saveDraft,
  deleteDraft,
  getDraft,
} from './payloads';

export type { StoredPayload, Settings, DraftPayload } from './payloads';

export {
  encodeToHash,
  decodeFromHash,
  generateShareUrl,
  hasSharedPayload,
  loadFromUrl,
  clearUrlHash,
  renderShareQrCode,
} from './share';
