/**
 * barcOwned Core Engine
 *
 * This is the heart of barcOwned - it transforms payload JSON into
 * sequences of barcode data that can reprogram scanners and execute payloads.
 *
 * ## How It Works
 *
 * 1. **Setup Phase**: Generate programming barcodes that install ADF rules
 *    into the scanner's firmware. These rules define pattern → action mappings.
 *
 * 2. **Payload Phase**: Generate trigger barcodes that match the installed
 *    rules, causing the scanner to emit keystrokes.
 *
 * ## Example Flow
 *
 * Payload JSON:
 * ```json
 * {
 *   "setup": {
 *     "rules": [{
 *       "criteria": [["stringatstart", "!"]],
 *       "actions": [["sendgui", "R"], ["skipcharacters", "1"], ["sendremaining"], ["sendenter"]]
 *     }]
 *   },
 *   "payload": ["!calc.exe"]
 * }
 * ```
 *
 * Becomes:
 * 1. Setup barcodes: [enter config, define rule, save rule, exit config]
 * 2. Payload barcode: "!calc.exe" (triggers the rule, presses Win+R, types "calc.exe", Enter)
 */

import type {
  Payload,
  BarcodeEntry,
  BarcodeData,
  ScannerModel,
  AdfRule,
  AdfCriteria,
  AdfAction,
  ModelFunction,
  ScriptType,
} from './types';

/**
 * The main barcOwned engine class.
 * Takes a scanner model and generates barcodes from payloads.
 */
export class BarcOwned {
  private model: ScannerModel;

  constructor(model: ScannerModel) {
    this.model = model;
  }

  /**
   * Get the scanner model.
   */
  getModel(): ScannerModel {
    return this.model;
  }

  /**
   * Generate all barcode data for a payload.
   * This is the main entry point for barcode generation.
   *
   * @param payload - The payload to generate barcodes for
   * @returns BarcodeData with setup barcodes (if any) followed by payload barcodes
   */
  getBarcodeData(payload: Payload): BarcodeData {
    const result: BarcodeData = {
      barcodes: [],
      symbology: payload.symbology ?? this.model.symbology,
      BWIPPoptions: {
        ...this.model.bwippoptions,
        ...payload.bwippoptions,
      },
      setupCount: 0,
    };

    // Generate setup barcodes (scanner programming)
    if (payload.setup) {
      const setupData = this.getSetupBarcodeData(payload);
      result.barcodes.push(...setupData.barcodes);
      result.setupCount = setupData.barcodes.length;
    }

    // Generate payload barcodes (triggers)
    const payloadData = this.getPayloadBarcodeData(payload);
    result.barcodes.push(...payloadData.barcodes);

    // Apply model-specific optimizations (e.g., C40 aggregation)
    if (this.model.optimizeBarcodeData) {
      const combined = this.model.optimizeBarcodeData(result);
      if (combined && combined !== result) {
        return { ...result, combined };
      }
    }

    return result;
  }

  /**
   * Generate barcodes for the setup phase only.
   * These barcodes reprogram the scanner with ADF rules.
   */
  getSetupBarcodeData(payload: Payload): BarcodeData {
    const setup = payload.setup;
    if (!setup) {
      return this.emptyBarcodeData('setup');
    }

    const barcodes: BarcodeEntry[] = [];
    const modelSetup = this.model.setup;
    const modelAdf = this.model.adf;

    // Enter config mode
    if (modelSetup?.enterconfig) {
      for (const code of modelSetup.enterconfig) {
        barcodes.push(this.createBarcode(code, 'setup', 'enter setup mode'));
      }
    }

    // Apply setup options (e.g., enable presentation mode)
    if (setup.options && modelSetup?.options) {
      for (const optionName of setup.options) {
        const optionCodes = modelSetup.options[optionName];
        if (optionCodes) {
          for (const code of optionCodes) {
            barcodes.push(
              this.createBarcode(
                code,
                'setup',
                this.formatSetupOptionComment(optionName)
              )
            );
          }
        }
      }
    }

    // Generate ADF rules
    const rules = setup.rules ?? setup.adf ?? [];
    if (rules.length > 0 && modelAdf) {
      for (const rule of rules) {
        barcodes.push(...this.generateRule(rule, modelAdf));
      }
    }

    // Exit config mode
    if (modelSetup?.exitconfig) {
      for (const code of modelSetup.exitconfig) {
        barcodes.push(this.createBarcode(code, 'setup', 'exit setup mode'));
      }
    }

    return {
      barcodes,
      symbology: modelSetup?.symbology ?? this.model.symbology,
      BWIPPoptions: this.model.bwippoptions ?? {},
      setupCount: barcodes.length,
    };
  }

  /**
   * Generate barcodes for the payload phase only.
   * These are the trigger barcodes that activate ADF rules.
   */
  getPayloadBarcodeData(payload: Payload): BarcodeData {
    return {
      barcodes: payload.payload.map((code) => ({
        code,
        comment: this.formatPayloadComment(code),
      })),
      symbology: payload.symbology ?? this.model.symbology,
      BWIPPoptions: {
        ...this.model.bwippoptions,
        ...payload.bwippoptions,
      },
      setupCount: 0,
    };
  }

  private formatSetupOptionComment(optionName: string): string {
    return `set option: ${optionName}`;
  }

  private formatPayloadComment(code: string): string {
    return `payload: ${code}`;
  }

  private formatCriterionComment(
    type: string,
    args: string[]
  ): { base: string; perChar?: (char: string, index: number) => string } {
    switch (type) {
      case 'stringatstart':
        return {
          base: 'condition starts with',
          perChar: (char) => `condition starts with '${char}'`,
        };
      case 'stringsearch':
        return {
          base: 'condition contains',
          perChar: (char) => `condition contains '${char}'`,
        };
      case 'stringatposition':
        return {
          base: 'condition position match',
          perChar: (char, index) =>
            index === 0
              ? `condition position ${char}`
              : `condition match '${char}'`,
        };
      default:
        return { base: `condition ${type}${args.length ? `: ${args.join(' ')}` : ''}` };
    }
  }

  private formatActionComment(
    type: string,
    args: string[]
  ): { base: string; perChar?: (char: string, index: number) => string } {
    switch (type) {
      case 'sendtext':
        return { base: 'type text', perChar: (char) => `key ${char}` };
      case 'sendgui':
        return { base: 'press Win+key', perChar: (char) => `Win+${char}` };
      case 'sendcontrol':
        return { base: 'press Ctrl+key', perChar: (char) => `Ctrl+${char}` };
      case 'sendalt':
        return { base: 'press Alt+key', perChar: (char) => `Alt+${char}` };
      case 'sendshift':
        return { base: 'press Shift+key', perChar: (char) => `Shift+${char}` };
      case 'sendarrowkey':
        return { base: `arrow ${args[0] ?? ''}`.trim() };
      case 'sendpausealt':
        return { base: `Alt code ${args[0] ?? ''}`.trim() };
      case 'pauseduration':
        return { base: `set pause duration ${args[0] ?? ''}s`.trim() };
      case 'skipcharacters':
        return { base: `skip ${args[0] ?? ''} characters`.trim() };
      case 'sendremaining':
        return { base: 'send remaining data' };
      case 'sendenter':
        return { base: 'key Enter' };
      case 'sendpause':
        return { base: 'pause' };
      default:
        return { base: `action ${type}${args.length ? `: ${args.join(' ')}` : ''}` };
    }
  }

  private createBarcode(
    code: string,
    type: ScriptType,
    comment?: string,
    overrides?: Partial<BarcodeEntry>
  ): BarcodeEntry {
    return {
      code: this.wrap(code, type),
      comment,
      ...overrides,
    };
  }

  /**
   * Generate barcodes for a single ADF rule.
   *
   * An ADF rule consists of:
   * 1. Enter rule definition mode
   * 2. Define criteria (pattern matching conditions)
   * 3. Define actions (what to do when matched)
   * 4. Save the rule
   */
  private generateRule(rule: AdfRule, adf: typeof this.model.adf): BarcodeEntry[] {
    if (!adf) return [];

    const barcodes: BarcodeEntry[] = [];

    // Enter rule definition mode
    for (const code of adf.enterconfig) {
      barcodes.push(this.createBarcode(code, 'setup', 'begin rule'));
    }

    // Generate criteria barcodes
    for (const criterion of rule.criteria) {
      barcodes.push(...this.generateCriterion(criterion, adf));
    }

    // Generate action barcodes
    for (const action of rule.actions) {
      barcodes.push(...this.generateAction(action, adf));
    }

    // Save the rule
    for (const code of adf.exitconfig) {
      barcodes.push(this.createBarcode(code, 'setup', 'save rule'));
    }

    return barcodes;
  }

  /**
   * Generate barcodes for a single criterion.
   *
   * Criteria types include:
   * - stringatstart: matches if barcode starts with given string
   * - stringsearch: matches if barcode contains given string
   * - stringatposition: matches character at specific position
   */
  private generateCriterion(criterion: AdfCriteria, adf: typeof this.model.adf): BarcodeEntry[] {
    if (!adf) return [];

    const [type, ...args] = criterion;
    const criterionDef = adf.criteria[type];

    if (!criterionDef) {
      console.warn(`Unknown criterion type: ${type}`);
      return [];
    }

    const comment = this.formatCriterionComment(type, args);

    // Simple string criterion (no processing needed)
    if (typeof criterionDef === 'string') {
      return [this.createBarcode(criterionDef, 'setup', comment.base)];
    }

    return this.generateModelFunction(criterionDef, args, adf, comment.base, comment.perChar);
  }

  /**
   * Generate barcodes for a single action.
   *
   * Action types include:
   * - sendtext: type characters
   * - sendgui: press Win+key
   * - sendcontrol: press Ctrl+key
   * - sendalt: press Alt+key
   * - sendenter: press Enter
   * - sendremaining: type rest of barcode data
   * - skipcharacters: skip N characters
   * - pauseduration: delay N seconds
   */
  private generateAction(action: AdfAction, adf: typeof this.model.adf): BarcodeEntry[] {
    if (!adf) return [];

    const [type, ...args] = action;
    const actionDef = adf.actions[type];

    if (!actionDef) {
      console.warn(`Unknown action type: ${type}`);
      return [];
    }

    const comment = this.formatActionComment(type, args);

    // Simple string action (no processing needed)
    if (typeof actionDef === 'string') {
      return [this.createBarcode(actionDef, 'setup', comment.base)];
    }

    return this.generateModelFunction(actionDef, args, adf, comment.base, comment.perChar);
  }

  /**
   * Generate barcodes for a model function (criterion or action).
   *
   * Model functions can be:
   * - static: single fixed barcode
   * - single: one barcode per input, with processing
   * - multiple: one barcode per character, with processing
   * - charmap: map each character through the model's character mapper
   */
  private generateModelFunction(
    func: ModelFunction,
    args: string[],
    adf: typeof this.model.adf,
    commentBase?: string,
    commentForChar?: (char: string, index: number) => string
  ): BarcodeEntry[] {
    if (!adf) return [];

    const barcodes: BarcodeEntry[] = [];
    const input = args.join('');

    const enterComment = commentBase ? `${commentBase} (enter)` : 'enter config';
    const exitComment = commentBase ? `${commentBase} (exit)` : 'exit config';
    const endComment = commentBase ? `${commentBase} (end)` : 'end message';

    // Emit enter config barcodes
    if (func.enterconfig) {
      for (const code of func.enterconfig) {
        barcodes.push(this.createBarcode(code, 'setup', enterComment));
      }
    }

    const prefix = func.prefix ?? '';
    const postfix = func.postfix ?? '';

    switch (func.type) {
      case 'charmap':
        // Map each character through the model's character mapper
        if (adf.mapcharacter?.process) {
          Array.from(input).forEach((char, index) => {
            const mapped = adf.mapcharacter!.process(char, adf);
            const codes = Array.isArray(mapped) ? mapped : [mapped];
            const comment = commentForChar ? commentForChar(char, index) : commentBase;
            for (const code of codes) {
              barcodes.push(this.createBarcode(prefix + code + postfix, 'setup', comment));
            }
          });
        }
        break;

      case 'multiple':
        // Process each character separately
        if (func.process) {
          Array.from(input).forEach((char, index) => {
            const processed = func.process!(char, adf);
            const codes = Array.isArray(processed) ? processed : [processed];
            const comment = commentForChar ? commentForChar(char, index) : commentBase;
            for (const code of codes) {
              if (code !== undefined) {
                barcodes.push(this.createBarcode(prefix + code + postfix, 'setup', comment));
              }
            }
          });
        }
        break;

      case 'single':
        // Process entire input as one unit
        if (func.process) {
          const processed = func.process(input, adf);
          const codes = Array.isArray(processed) ? processed : [processed];
          for (const code of codes) {
            if (code !== undefined) {
              barcodes.push(this.createBarcode(prefix + code + postfix, 'setup', commentBase));
            }
          }
        }
        break;

      default:
        // Static: just emit the prefix (no input processing)
        if (prefix) {
          barcodes.push(this.createBarcode(prefix + postfix, 'setup', commentBase));
        }
    }

    // Emit end message if needed
    if (func.sendendmessage && adf.endmessage) {
      barcodes.push(this.createBarcode(adf.endmessage, 'setup', endComment));
    }

    // Emit exit config barcodes
    if (func.exitconfig) {
      for (const code of func.exitconfig) {
        barcodes.push(this.createBarcode(code, 'setup', exitComment));
      }
    }

    return barcodes;
  }

  /**
   * Wrap a barcode with the appropriate prefix/postfix for its type.
   */
  private wrap(code: string, type: ScriptType): string {
    if (type === 'setup') {
      const setup = this.model.setup;
      const adf = this.model.adf;
      const prefix = setup?.prefix ?? adf?.prefix ?? '';
      const postfix = setup?.postfix ?? adf?.postfix ?? '';
      return prefix + code + postfix;
    }
    return code;
  }

  /**
   * Create an empty barcode data result.
   */
  private emptyBarcodeData(type: ScriptType): BarcodeData {
    const setup = this.model.setup;
    return {
      barcodes: [],
      symbology: type === 'setup'
        ? (setup?.symbology ?? this.model.symbology)
        : this.model.symbology,
      BWIPPoptions: this.model.bwippoptions ?? {},
      setupCount: 0,
    };
  }
}
