/**
 * URL Sharing Module
 * 
 * Encodes/decodes payload configurations in URL fragments for sharing.
 * This enables the QR-code-to-phone workflow:
 * 
 * 1. User creates payload on laptop
 * 2. User clicks "share" → QR code with URL appears
 * 3. User scans QR with phone camera
 * 4. Phone opens barcOwned with payload loaded, ready to run
 * 
 * ## URL Format
 * 
 * https://uberkitten.github.io/barcOwned/#payload=<base64>
 * 
 * The payload is JSON, gzipped (if beneficial), then base64url encoded.
 */

import type { Payload } from '../core/types';
import type { Settings } from './payloads';
import { renderToCanvas } from '../core/render';

/**
 * Data structure encoded in URL.
 */
interface SharedData {
  version: 1;
  payload: Payload;
  settings?: Partial<Settings>;
}

/**
 * Encode a payload (and optional settings) to a URL hash string.
 */
export function encodeToHash(payload: Payload, settings?: Partial<Settings>): string {
  const data: SharedData = {
    version: 1,
    payload,
    settings,
  };

  const json = JSON.stringify(data);
  
  // Try to compress with gzip if available and beneficial
  // For now, just use base64 - can add compression later if needed
  const encoded = btoa(unescape(encodeURIComponent(json)));
  
  return `payload=${encoded}`;
}

/**
 * Decode a payload from a URL hash string.
 */
export function decodeFromHash(hash: string): SharedData | undefined {
  try {
    // Remove leading # if present
    const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
    
    // Parse query string
    const params = new URLSearchParams(cleanHash);
    const encoded = params.get('payload');
    
    if (!encoded) return undefined;
    
    // Decode base64
    const json = decodeURIComponent(escape(atob(encoded)));
    const data = JSON.parse(json);
    
    // Validate version
    if (data.version !== 1) {
      console.warn(`Unknown share format version: ${data.version}`);
    }
    
    return data;
  } catch (e) {
    console.error('Failed to decode shared payload:', e);
    return undefined;
  }
}

/**
 * Generate a full shareable URL.
 */
export function generateShareUrl(payload: Payload, settings?: Partial<Settings>): string {
  const hash = encodeToHash(payload, settings);
  const base = window.location.origin + window.location.pathname;
  return `${base}#${hash}`;
}

/**
 * Check if current URL has a shared payload.
 */
export function hasSharedPayload(): boolean {
  return window.location.hash.includes('payload=');
}

/**
 * Load shared payload from current URL.
 */
export function loadFromUrl(): SharedData | undefined {
  if (!hasSharedPayload()) return undefined;
  return decodeFromHash(window.location.hash);
}

/**
 * Clear the URL hash (after loading a shared payload).
 */
export function clearUrlHash(): void {
  history.replaceState(null, '', window.location.pathname);
}

/**
 * Render a QR code to a canvas element using bwip-js.
 * 
 * @param canvas - Target canvas element
 * @param url - URL to encode in the QR code
 */
export async function renderShareQrCode(
  canvas: HTMLCanvasElement,
  url: string
): Promise<void> {
  await renderToCanvas(canvas, {
    symbology: 'qrcode',
    data: url,
    scale: 4,
    backgroundcolor: 'ffffff',
    barcolor: '000000',
  });
}
