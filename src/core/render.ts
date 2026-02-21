/**
 * Barcode Renderer
 * 
 * Renders barcode data to canvas/image using bwip-js.
 * bwip-js is a JavaScript port of BWIPP (Barcode Writer in Pure PostScript),
 * which supports 100+ barcode symbologies.
 * 
 * ## Supported Symbologies (commonly used in barcOwned)
 * 
 * - code128: High-density 1D barcode, supports all ASCII
 * - datamatrix: 2D barcode, high data density, good for phone screens
 * - qrcode: 2D barcode, widely recognized, good error correction
 * 
 * ## Special Characters
 * 
 * bwip-js supports parsing special characters:
 * - ^FNC1, ^FNC2, ^FNC3, ^FNC4: Function codes (used for scanner programming)
 * - ^NNN: Caret + 3 digits = character code
 * 
 * FNC3 is particularly important - it tells Symbol scanners to enter config mode.
 */

// @ts-ignore - bwip-js types are incomplete
import bwipjs from 'bwip-js';

/**
 * Options for barcode rendering.
 */
export interface RenderOptions {
  /** Barcode symbology (e.g., 'code128', 'datamatrix', 'qrcode') */
  symbology: string;
  /** Data to encode */
  data: string;
  /** Scale factor (default: 3) */
  scale?: number;
  /** Include human-readable text below barcode */
  includetext?: boolean;
  /** Text X offset */
  textxalign?: 'center' | 'left' | 'right';
  /** Background color (default: 'ffffff') */
  backgroundcolor?: string;
  /** Bar color (default: '000000') */
  barcolor?: string;
  /** Parse FNC codes like ^FNC3 */
  parsefnc?: boolean;
  /** Additional BWIPP options */
  [key: string]: unknown;
}

/**
 * Render a barcode to a canvas element.
 * 
 * @param canvas - Target canvas element
 * @param options - Rendering options
 */
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  options: RenderOptions
): Promise<void> {
  const {
    symbology,
    data,
    scale = 3,
    includetext = false,
    backgroundcolor = 'ffffff',
    barcolor = '000000',
    parsefnc = true,
    ...rest
  } = options;

  // Map our symbology names to bwip-js names
  const bcid = mapSymbology(symbology);

  await bwipjs.toCanvas(canvas, {
    bcid,
    text: data,
    scale,
    includetext,
    backgroundcolor,
    barcolor,
    parsefnc,
    ...rest,
  });
}

/**
 * Render a barcode to a data URL (PNG).
 * 
 * @param options - Rendering options
 * @returns Data URL string (image/png)
 */
export async function renderToDataURL(options: RenderOptions): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderToCanvas(canvas, options);
  return canvas.toDataURL('image/png');
}

/**
 * Map our symbology names to bwip-js bcid values.
 * bwip-js uses BWIPP encoder names which can be different.
 */
function mapSymbology(symbology: string): string {
  const map: Record<string, string> = {
    code128: 'code128',
    'code-128': 'code128',
    datamatrix: 'datamatrix',
    'data-matrix': 'datamatrix',
    qrcode: 'qrcode',
    'qr-code': 'qrcode',
    qr: 'qrcode',
    code39: 'code39',
    'code-39': 'code39',
    ean13: 'ean13',
    'ean-13': 'ean13',
    ean8: 'ean8',
    'ean-8': 'ean8',
    upca: 'upca',
    'upc-a': 'upca',
    upce: 'upce',
    'upc-e': 'upce',
    pdf417: 'pdf417',
    azteccode: 'azteccode',
    aztec: 'azteccode',
  };

  return map[symbology.toLowerCase()] ?? symbology;
}

/**
 * Get recommended canvas dimensions for a barcode.
 * Useful for pre-sizing canvas before rendering.
 * 
 * @param symbology - Barcode type
 * @param dataLength - Length of data to encode
 * @param scale - Scale factor
 */
export function estimateDimensions(
  symbology: string,
  dataLength: number,
  scale: number = 3
): { width: number; height: number } {
  // These are rough estimates - actual size depends on data content
  const bcid = mapSymbology(symbology);
  
  switch (bcid) {
    case 'code128':
      // Code 128: ~11 modules per character + start/stop
      return {
        width: (dataLength * 11 + 35) * scale,
        height: 50 * scale,
      };
    
    case 'datamatrix':
      // DataMatrix: roughly square, size increases with data
      const dmSize = Math.ceil(Math.sqrt(dataLength * 8)) * 2 + 10;
      return {
        width: dmSize * scale,
        height: dmSize * scale,
      };
    
    case 'qrcode':
      // QR: similar to DataMatrix
      const qrSize = Math.ceil(Math.sqrt(dataLength * 8)) * 2 + 20;
      return {
        width: qrSize * scale,
        height: qrSize * scale,
      };
    
    default:
      return {
        width: dataLength * 15 * scale,
        height: 50 * scale,
      };
  }
}

/**
 * Check if a symbology is 2D (matrix) or 1D (linear).
 */
export function is2D(symbology: string): boolean {
  const bcid = mapSymbology(symbology);
  const twoDSymbologies = [
    'datamatrix',
    'qrcode',
    'pdf417',
    'azteccode',
    'maxicode',
  ];
  return twoDSymbologies.includes(bcid);
}
