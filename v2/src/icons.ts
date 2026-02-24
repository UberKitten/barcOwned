/**
 * Lucide Icons (MIT License)
 * https://lucide.dev
 * 
 * Inline SVG strings for barcOwned v2
 * Icons sized for 16px (toolbar) or 20px (larger buttons)
 */

// Using currentColor so icons inherit text color
const createIcon = (path: string, size = 16): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  ${path}
</svg>
`.trim();

// Logo / Brand - custom barcode icon
export const iconBarcode = createIcon(`
  <path d="M3 5v14"/>
  <path d="M8 5v14"/>
  <path d="M12 5v14"/>
  <path d="M17 5v14"/>
  <path d="M21 5v14"/>
`);

// Menu (hamburger)
export const iconMenu = createIcon(`
  <line x1="4" x2="20" y1="12" y2="12"/>
  <line x1="4" x2="20" y1="6" y2="6"/>
  <line x1="4" x2="20" y1="18" y2="18"/>
`);

// Close / X
export const iconX = createIcon(`
  <path d="M18 6 6 18"/>
  <path d="m6 6 12 12"/>
`);

// Trash (delete)
export const iconTrash = createIcon(`
  <path d="M3 6h18"/>
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  <path d="M10 11v6"/>
  <path d="M14 11v6"/>
  <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/>
`);

// Save
export const iconSave = createIcon(`
  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
  <path d="M7 3v4a1 1 0 0 0 1 1h7"/>
`);

// Play (run)
export const iconPlay = createIcon(`
  <polygon points="6 3 20 12 6 21 6 3"/>
`, 20);

// Square (stop)
export const iconSquare = createIcon(`
  <rect width="14" height="14" x="5" y="5" rx="2"/>
`, 20);

// Share / external link
export const iconShare = createIcon(`
  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
  <polyline points="16 6 12 2 8 6"/>
  <line x1="12" x2="12" y1="2" y2="15"/>
`);

// Chevron left
export const iconChevronLeft = createIcon(`
  <path d="m15 18-6-6 6-6"/>
`, 20);

// Chevron right
export const iconChevronRight = createIcon(`
  <path d="m9 18 6-6-6-6"/>
`, 20);

// Package (preset indicator)
export const iconPackage = createIcon(`
  <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/>
  <path d="M12 22V12"/>
  <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>
`, 12);

// Plus (new)
export const iconPlus = createIcon(`
  <path d="M5 12h14"/>
  <path d="M12 5v14"/>
`);

// Download / file-input (import)
export const iconImport = createIcon(`
  <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
  <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
  <path d="M2 15h10"/>
  <path d="m9 18 3-3-3-3"/>
`);

// Upload / file-output (export)
export const iconExport = createIcon(`
  <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
  <path d="M4 7V4a2 2 0 0 1 2-2h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>
  <path d="M2 15h10"/>
  <path d="m5 12-3 3 3 3"/>
`);

// Copy
export const iconCopy = createIcon(`
  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
`);

// Pause
export const iconPause = createIcon(`
  <rect x="6" y="4" width="4" height="16"/>
  <rect x="14" y="4" width="4" height="16"/>
`, 20);

// Minus
export const iconMinus = createIcon(`
  <path d="M5 12h14"/>
`);

// Maximize / fullscreen
export const iconMaximize = createIcon(`
  <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
  <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
  <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
  <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
`);

// Undo (discard)
export const iconUndo = createIcon(`
  <path d="M9 14 4 9l5-5"/>
  <path d="M4 9h10a6 6 0 0 1 0 12h-1"/>
`);

// Arrow left (back)
export const iconArrowLeft = createIcon(`
  <path d="m12 19-7-7 7-7"/>
  <path d="M19 12H5"/>
`);

// Panel right (preview toggle)
export const iconPanelRight = createIcon(`
  <rect x="3" y="4" width="18" height="16" rx="2"/>
  <line x1="15" y1="4" x2="15" y2="20"/>
`);

// ScanBarcode (alternate logo option)
export const iconScanBarcode = createIcon(`
  <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
  <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
  <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
  <path d="M7 8v8"/>
  <path d="M12 8v8"/>
  <path d="M17 8v8"/>
`, 20);

// External link (for docs/github)
export const iconExternalLink = createIcon(`
  <path d="M15 3h6v6"/>
  <path d="M10 14 21 3"/>
  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
`);
