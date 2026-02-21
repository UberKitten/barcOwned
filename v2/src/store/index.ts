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
} from './payloads';

export type { StoredPayload, Settings } from './payloads';

export {
  encodeToHash,
  decodeFromHash,
  generateShareUrl,
  hasSharedPayload,
  loadFromUrl,
  clearUrlHash,
  generateQrCodeUrl,
} from './share';
