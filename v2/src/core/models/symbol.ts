/**
 * Motorola/Zebra Symbol Scanner Model
 * 
 * This model supports Symbol/Zebra barcode scanners with ADF (Advanced Data Formatting).
 * These scanners are extremely common in retail, warehousing, and logistics.
 * 
 * ## How Symbol ADF Works
 * 
 * Symbol scanners support "parameter scanning" - you can configure them by scanning
 * special barcodes that start with FNC3 (Function Code 3). The scanner recognizes
 * these as configuration commands rather than data.
 * 
 * ADF rules are stored in scanner firmware and define:
 * - Criteria: patterns to match in scanned data
 * - Actions: keystrokes/transformations to apply when matched
 * 
 * ## Barcode Format
 * 
 * Setup barcodes: ^FNC3 + command code
 * The ^FNC3 prefix tells bwip-js to encode FNC3 as a control character.
 * 
 * ## References
 * 
 * - Zebra Scanner SDK documentation
 * - Symbol ADF Programming Guide
 * - Scanner product reference guides
 */

import type { ScannerModel, BarcodeData } from '../types';

/**
 * Motorola/Zebra Symbol scanner model definition.
 */
export const symbolModel: ScannerModel = {
  name: 'Motorola/Zebra Symbol',
  symbology: 'code128',
  autoRate: 1.0, // approx rate in Hz for auto-advance mode

  setup: {
    symbology: 'code128',
    autoRate: 0.5, // setup barcodes need more time to process
    prefix: '^FNC3',
    postfix: '',
    enterconfig: [],
    exitconfig: [],
    options: {
      // Presentation mode - scanner constantly reads without trigger pull
      scanpresentation: ['2050207'],
      // Enable parameter scanning (required for ADF programming)
      enableparameterscanning: ['1040601'],
      // Better recognition for phone/tablet screens
      mobilephonedecode: [
        'N02CC03', // Mobile Phone Decode Enable
        'N02D60D', // Mobile Phone Decode High Aggressive
      ],
      // Rule management
      eraseallrules: ['80'], // Erase all ADF rules
      restoredefaults: ['91'], // Restore custom defaults
      setfactorydefaults: ['92'], // Full factory reset, deletes custom defaults
      // Display optimization
      indirectillumination: ['N023B03'], // Better for shiny/reflective surfaces
    },
  },

  adf: {
    prefix: '^FNC3',
    postfix: '',
    enterconfig: ['7B1211'], // Begin new rule
    exitconfig: ['4'], // Save rule
    endmessage: 'B+', // End of text sequence marker

    /**
     * Criteria types - conditions for rule matching
     */
    criteria: {
      /**
       * Match if character at specific position equals value.
       * Args: [position, character]
       */
      stringatposition: {
        type: 'charmap',
        sendendmessage: true,
        enterconfig: ['6C200'],
        prefix: 'B',
      },

      /**
       * Match if barcode starts with given string.
       * Args: [string]
       */
      stringatstart: {
        type: 'charmap',
        sendendmessage: true,
        enterconfig: ['6C201'],
        prefix: 'B',
      },

      /**
       * Match if barcode contains given string anywhere.
       * Args: [string]
       */
      stringsearch: {
        type: 'charmap',
        sendendmessage: true,
        enterconfig: ['6C202'],
        prefix: 'B',
      },
    },

    /**
     * Action types - what to do when criteria match
     */
    actions: {
      /**
       * Type text characters.
       * Args: [text]
       * Each character is sent as a separate barcode.
       */
      sendtext: {
        type: 'charmap',
        prefix: '6A1441',
      },

      /**
       * Send Alt+key combination.
       * Args: [key]
       * Special handling: '2' = 0x40, letters = ASCII hex
       */
      sendalt: {
        type: 'multiple',
        prefix: '6A1442',
        process: (input: string): string => {
          if (input === '2') return '40';
          return input.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
        },
      },

      /**
       * Send Ctrl+key combination.
       * Args: [key]
       * Letters A-Z map to 0x01-0x1A, special chars have specific codes.
       */
      sendcontrol: {
        type: 'multiple',
        sendendmessage: true,
        prefix: '6A1441',
        process: (input: string): string => {
          // Special characters
          if (input === '2') return '00';
          if (input === '[') return '1B';
          if (input === '\\') return '1C';
          if (input === ']') return '1D';
          if (input === '6') return '1E';
          if (input === '-') return '1F';

          // Letters A-Z: convert to control codes (A=0x01, Z=0x1A)
          const code = input.toUpperCase().charCodeAt(0);
          if (code >= 65 && code <= 90) {
            return (code - 64).toString(16).toUpperCase().padStart(2, '0');
          }
          return '';
        },
      },

      /**
       * Set pause duration for subsequent pauses.
       * Args: [seconds] (can be decimal, e.g., "1.5")
       */
      pauseduration: {
        type: 'single',
        enterconfig: ['30C0D20063'],
        prefix: 'A',
        process: (input: string): string[] => {
          const value = parseFloat(input);
          return [
            Math.floor(value).toString(),
            Math.floor((value % 1) * 10).toString(),
          ];
        },
      },

      /**
       * Send Alt+key with pause (for Windows Alt codes).
       * Args: [keycode]
       */
      sendpausealt: {
        type: 'single',
        prefix: '6A14E5',
        process: (input: string): string => {
          return parseInt(input, 10).toString(16).toUpperCase().padStart(2, '0');
        },
      },

      /**
       * Send Win+key combination.
       * Args: [key]
       */
      sendgui: {
        type: 'charmap',
        prefix: '6A1443',
      },

      /**
       * Send a pause (uses previously set duration).
       */
      sendpause: '6A118',

      /**
       * Send Enter key.
       */
      sendenter: '6A14470D',

      /**
       * Send remaining barcode data (everything not yet consumed).
       */
      sendremaining: '6A110',

      /**
       * Skip N characters from the barcode data.
       * Args: [count]
       */
      skipcharacters: {
        type: 'single',
        prefix: '6A1433',
        process: (input: string): string => {
          return parseInt(input, 10).toString(16).toUpperCase().padStart(2, '0');
        },
      },

      /**
       * Send arrow key.
       * Args: ['up' | 'down' | 'left' | 'right']
       */
      sendarrowkey: {
        type: 'single',
        prefix: '6A1447',
        process: (input: string): string => {
          const keys: Record<string, string> = {
            up: '0F',
            down: '10',
            left: '11',
            right: '12',
          };
          return keys[input.toLowerCase()] ?? '';
        },
      },
    },

    /**
     * Character mapper for encoding text as ADF barcodes.
     * Each character is converted to its ASCII hex representation.
     */
    mapcharacter: {
      type: 'multiple',
      process: (input: string): string => {
        // Convert character to uppercase hex ASCII code
        return input.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
      },
    },
  },

  /**
   * BWIPP options for this scanner.
   * parsefnc: true enables FNC1-4 parsing in Code 128.
   */
  bwippoptions: {
    parsefnc: true,
  },

  /**
   * Optimize barcode data for this scanner.
   * Currently a pass-through - C40 aggregation could be implemented here.
   * 
   * TODO: Port the C40 DataMatrix aggregation from the original main.js
   * This combines multiple setup barcodes into fewer 2D barcodes.
   */
  optimizeBarcodeData: (data: BarcodeData): BarcodeData => {
    // For now, return unoptimized
    // Future: implement C40 aggregation for DataMatrix
    return data;
  },
};

export default symbolModel;
