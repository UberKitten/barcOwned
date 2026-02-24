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

import type { ScannerModel, BarcodeData, BarcodeEntry } from '../types';

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
    const setupCount = data.setupCount ?? 0;
    if (setupCount === 0 || data.barcodes.length === 0) return data;

    const setupBarcodes = data.barcodes.slice(0, setupCount);
    if (setupBarcodes.length === 0) return data;

    const encodeC40 = (barcode: string): string => {
      const getCodewords = (character: string): Array<{ set: number; value: number }> => {
        let ascii = character.charCodeAt(0);
        const codewords: Array<{ set: number; value: number }> = [];

        const addCodeword = (set: number, value: number) => {
          if (set !== 0) {
            codewords.push({
              set: 0,
              value: set - 1,
            });
          }
          codewords.push({ set, value });
        };

        if (ascii >= 128 && ascii <= 255) {
          addCodeword(2, 30);
          ascii -= 128;
        }

        if (ascii === 32) {
          addCodeword(0, 3);
        } else if (ascii >= 48 && ascii <= 57) {
          addCodeword(0, ascii - (48 - 4));
        } else if (ascii >= 65 && ascii <= 90) {
          addCodeword(0, ascii - (65 - 14));
        } else if (ascii >= 0 && ascii <= 31) {
          addCodeword(1, ascii - (0 - 0));
        } else if (ascii >= 33 && ascii <= 47) {
          addCodeword(2, ascii - (33 - 0));
        } else if (ascii >= 58 && ascii <= 64) {
          addCodeword(2, ascii - (58 - 15));
        } else if (ascii >= 91 && ascii <= 95) {
          addCodeword(2, ascii - (91 - 22));
        } else if (ascii >= 96 && ascii <= 127) {
          addCodeword(3, ascii - (96 - 0));
        } else {
          console.error(`Character ${character} can not be encoded in C40`);
        }

        return codewords;
      };

      const isEscaped = (test: string, startIndex: number): boolean => {
        if (test.charAt(startIndex) !== '^') return false;
        if (startIndex + 3 >= test.length) return false;

        if (test.charAt(startIndex + 1) === '0' || test.charAt(startIndex + 1) === '1') {
          const c2 = test.charCodeAt(startIndex + 2);
          const c3 = test.charCodeAt(startIndex + 3);
          if (c2 >= 48 && c2 <= 57 && c3 >= 48 && c3 <= 57) return true;
        }

        if (test.charAt(startIndex + 1) === '2') {
          const c2 = test.charCodeAt(startIndex + 2);
          const c3 = test.charCodeAt(startIndex + 3);
          if (c2 >= 48 && c2 <= 53 && c3 >= 48 && c3 <= 53) return true;
        }

        return false;
      };

      const segments: string[] = [];
      let currentSegment = '';

      for (let i = 0; i < barcode.length; i++) {
        if (isEscaped(barcode, i)) {
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
          }
          currentSegment = '';
          segments.push(barcode.substring(i, i + 4));
          i += 3;
          continue;
        }
        currentSegment += barcode.charAt(i);
      }

      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      let encodedBarcode = '';

      for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex];
        if (isEscaped(segment, 0)) {
          if (segmentIndex > 0 && !isEscaped(segments[segmentIndex - 1], 0)) {
            encodedBarcode += '^254';
          }
          encodedBarcode += segment;
        } else {
          const charCodewords: Array<Array<{ set: number; value: number }>> = [];
          for (let i = 0; i < segment.length; i++) {
            charCodewords.push(getCodewords(segment.charAt(i)));
          }

          let unlatchChars = 0;
          for (unlatchChars = 0; unlatchChars < charCodewords.length; unlatchChars++) {
            let codewordLength = 0;
            for (let i = 0; i < charCodewords.length - unlatchChars; i++) {
              codewordLength += charCodewords[i].length;
            }
            if (codewordLength % 3 === 0) {
              break;
            }
          }

          if (charCodewords.length - unlatchChars > 0) {
            encodedBarcode += '^230';
          }

          let currentChunk: number[] = [];
          for (let i = 0; i < charCodewords.length - unlatchChars; i++) {
            for (let j = 0; j < charCodewords[i].length; j++) {
              currentChunk.push(charCodewords[i][j].value);
              if (currentChunk.length >= 3) {
                const code = (1600 * currentChunk[0]) + (40 * currentChunk[1]) + currentChunk[2] + 1;
                const char1 = Math.trunc(code / 256);
                const char2 = code % 256;
                encodedBarcode += `^${char1.toString().padStart(3, '0')}^${char2.toString().padStart(3, '0')}`;
                currentChunk = [];
              }
            }
          }

          if (charCodewords.length - unlatchChars > 0) {
            encodedBarcode += '^254';
          }

          for (let i = segment.length - unlatchChars; i < segment.length; i++) {
            encodedBarcode += `^${(segment.charCodeAt(i) + 1).toString().padStart(3, '0')}`;
          }
        }
      }

      return encodedBarcode + '^129';
    };

    let aggregateBarcode = '^234' + 'N6' + 'S2681000' + 'barcOwned       ';

    setupBarcodes.forEach((barcode) => {
      const cleaned = barcode.code
        .replace('^FNC3', '')
        .replace('7B1211', 'N57B1211');
      aggregateBarcode += cleaned;
    });

    const combinedEntry: BarcodeEntry = {
      code: encodeC40(aggregateBarcode),
      comment: 'combined setup (C40)',
      symbology: 'datamatrix',
      BWIPPoptions: {
        raw: true,
      },
    };

    const payloadEntries = data.barcodes.slice(setupCount).map((entry) => ({ ...entry }));

    return {
      barcodes: [combinedEntry, ...payloadEntries],
      symbology: data.symbology,
      BWIPPoptions: data.BWIPPoptions,
      setupCount: 1,
    };
  },
};

export default symbolModel;
