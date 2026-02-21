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
    };

    // Generate setup barcodes (scanner programming)
    if (payload.setup) {
      const setupData = this.getSetupBarcodeData(payload);
      result.barcodes.push(...setupData.barcodes);
    }

    // Generate payload barcodes (triggers)
    const payloadData = this.getPayloadBarcodeData(payload);
    result.barcodes.push(...payloadData.barcodes);

    // Apply model-specific optimizations (e.g., C40 aggregation)
    if (this.model.optimizeBarcodeData) {
      return this.model.optimizeBarcodeData(result);
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

    const barcodes: string[] = [];
    const modelSetup = this.model.setup;
    const modelAdf = this.model.adf;

    // Enter config mode
    if (modelSetup?.enterconfig) {
      for (const code of modelSetup.enterconfig) {
        barcodes.push(this.wrap(code, 'setup'));
      }
    }

    // Apply setup options (e.g., enable presentation mode)
    if (setup.options && modelSetup?.options) {
      for (const optionName of setup.options) {
        const optionCodes = modelSetup.options[optionName];
        if (optionCodes) {
          for (const code of optionCodes) {
            barcodes.push(this.wrap(code, 'setup'));
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
        barcodes.push(this.wrap(code, 'setup'));
      }
    }

    return {
      barcodes,
      symbology: modelSetup?.symbology ?? this.model.symbology,
      BWIPPoptions: this.model.bwippoptions ?? {},
    };
  }

  /**
   * Generate barcodes for the payload phase only.
   * These are the trigger barcodes that activate ADF rules.
   */
  getPayloadBarcodeData(payload: Payload): BarcodeData {
    return {
      barcodes: [...payload.payload],
      symbology: payload.symbology ?? this.model.symbology,
      BWIPPoptions: {
        ...this.model.bwippoptions,
        ...payload.bwippoptions,
      },
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
  private generateRule(rule: AdfRule, adf: typeof this.model.adf): string[] {
    if (!adf) return [];
    
    const barcodes: string[] = [];

    // Enter rule definition mode
    for (const code of adf.enterconfig) {
      barcodes.push(this.wrap(code, 'setup'));
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
      barcodes.push(this.wrap(code, 'setup'));
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
  private generateCriterion(criterion: AdfCriteria, adf: typeof this.model.adf): string[] {
    if (!adf) return [];
    
    const [type, ...args] = criterion;
    const criterionDef = adf.criteria[type];
    
    if (!criterionDef) {
      console.warn(`Unknown criterion type: ${type}`);
      return [];
    }

    return this.generateModelFunction(criterionDef, args, adf);
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
  private generateAction(action: AdfAction, adf: typeof this.model.adf): string[] {
    if (!adf) return [];
    
    const [type, ...args] = action;
    const actionDef = adf.actions[type];
    
    if (!actionDef) {
      console.warn(`Unknown action type: ${type}`);
      return [];
    }

    // Simple string action (no processing needed)
    if (typeof actionDef === 'string') {
      return [this.wrap(actionDef, 'setup')];
    }

    return this.generateModelFunction(actionDef, args, adf);
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
    adf: typeof this.model.adf
  ): string[] {
    if (!adf) return [];
    
    const barcodes: string[] = [];
    const input = args.join('');

    // Emit enter config barcodes
    if (func.enterconfig) {
      for (const code of func.enterconfig) {
        barcodes.push(this.wrap(code, 'setup'));
      }
    }

    const prefix = func.prefix ?? '';
    const postfix = func.postfix ?? '';

    switch (func.type) {
      case 'charmap':
        // Map each character through the model's character mapper
        if (adf.mapcharacter?.process) {
          for (const char of input) {
            const mapped = adf.mapcharacter.process(char, adf);
            const codes = Array.isArray(mapped) ? mapped : [mapped];
            for (const code of codes) {
              barcodes.push(this.wrap(prefix + code + postfix, 'setup'));
            }
          }
        }
        break;

      case 'multiple':
        // Process each character separately
        if (func.process) {
          for (const char of input) {
            const processed = func.process(char, adf);
            const codes = Array.isArray(processed) ? processed : [processed];
            for (const code of codes) {
              if (code !== undefined) {
                barcodes.push(this.wrap(prefix + code + postfix, 'setup'));
              }
            }
          }
        }
        break;

      case 'single':
        // Process entire input as one unit
        if (func.process) {
          const processed = func.process(input, adf);
          const codes = Array.isArray(processed) ? processed : [processed];
          for (const code of codes) {
            if (code !== undefined) {
              barcodes.push(this.wrap(prefix + code + postfix, 'setup'));
            }
          }
        }
        break;

      default:
        // Static: just emit the prefix (no input processing)
        if (prefix) {
          barcodes.push(this.wrap(prefix + postfix, 'setup'));
        }
    }

    // Emit end message if needed
    if (func.sendendmessage && adf.endmessage) {
      barcodes.push(this.wrap(adf.endmessage, 'setup'));
    }

    // Emit exit config barcodes
    if (func.exitconfig) {
      for (const code of func.exitconfig) {
        barcodes.push(this.wrap(code, 'setup'));
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
    };
  }
}
