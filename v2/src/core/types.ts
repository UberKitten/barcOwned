/**
 * barcOwned Core Types
 * 
 * This file defines the data structures used throughout the barcode engine.
 * Understanding these types is key to understanding how barcOwned works.
 */

/**
 * A complete barcOwned payload - the JSON file format users create/edit.
 * 
 * Payloads have two parts:
 * 1. Setup - rules that reprogram the scanner's firmware
 * 2. Payload - the actual barcodes that trigger those rules
 */
export interface Payload {
  /** Human-readable name for this payload */
  name: string;
  /** Description of what this payload does */
  description?: string;
  /** Setup phase: scanner programming rules */
  setup?: PayloadSetup;
  /** Payload phase: trigger barcodes to scan */
  payload: string[];
  /** Override barcode symbology (e.g., 'code128', 'datamatrix') */
  symbology?: string;
  /** Override BWIPP rendering options */
  bwippoptions?: Record<string, unknown>;
}

/**
 * Setup phase configuration - defines how to reprogram the scanner.
 * 
 * Setup barcodes put the scanner into programming mode and define
 * ADF (Advanced Data Formatting) rules that transform scanned data.
 */
export interface PayloadSetup {
  /** Scanner configuration options to enable (e.g., 'scanpresentation') */
  options?: string[];
  /** ADF rules that define barcode → keystroke transformations */
  rules?: AdfRule[];
  /** @deprecated Use 'rules' instead */
  adf?: AdfRule[];
}

/**
 * An ADF (Advanced Data Formatting) rule.
 * 
 * ADF rules are the heart of barcOwned. Each rule has:
 * - Criteria: what barcode patterns to match
 * - Actions: what keystrokes to send when matched
 * 
 * Example: "If barcode starts with '!', press Win+R, skip the '!', type the rest, press Enter"
 */
export interface AdfRule {
  /** Conditions that must match for this rule to fire */
  criteria: AdfCriteria[];
  /** Actions to perform when criteria match */
  actions: AdfAction[];
}

/**
 * A single criterion for matching barcodes.
 * Format: [criteriaType, ...params]
 * 
 * Examples:
 * - ['stringatstart', '!'] - barcode must start with '!'
 * - ['stringsearch', 'http'] - barcode must contain 'http'
 * - ['stringatposition', '3', 'X'] - character at position 3 must be 'X'
 */
export type AdfCriteria = [string, ...string[]];

/**
 * A single action to perform.
 * Format: [actionType, ...params]
 * 
 * Examples:
 * - ['sendtext', 'hello'] - type "hello"
 * - ['sendgui', 'r'] - press Win+R
 * - ['sendcontrol', 'c'] - press Ctrl+C
 * - ['sendenter'] - press Enter
 * - ['skipcharacters', '1'] - skip 1 character from barcode data
 * - ['sendremaining'] - type the rest of the barcode data
 */
export type AdfAction = [string, ...string[]];

/**
 * A single barcode entry (code + optional metadata).
 */
export interface BarcodeEntry {
  /** Barcode data string to encode */
  code: string;
  /** Human-readable comment describing what this barcode does */
  comment?: string;
  /** Optional per-barcode symbology override */
  symbology?: string;
  /** Optional per-barcode BWIPP options override */
  BWIPPoptions?: Record<string, unknown>;
}

/**
 * Output from the barcode generation engine.
 * This is what gets rendered into actual barcodes.
 */
export interface BarcodeData {
  /** Array of barcode entries to encode */
  barcodes: BarcodeEntry[];
  /** Barcode symbology to use (e.g., 'code128', 'datamatrix') */
  symbology: string;
  /** BWIPP rendering options */
  BWIPPoptions: Record<string, unknown>;
  /** Number of setup barcodes at the start of the list */
  setupCount?: number;
  /** Optional combined/optimized variant (e.g., C40 aggregation) */
  combined?: BarcodeData;
}

/**
 * A scanner model definition.
 * 
 * Each scanner brand/model has different programming codes.
 * This interface defines the capabilities and codes for a specific scanner.
 */
export interface ScannerModel {
  /** Human-readable model name */
  name: string;
  /** Default barcode symbology for this scanner */
  symbology: string;
  /** Approximate rate (Hz) for auto-advance mode */
  autoRate?: number;
  /** Default BWIPP rendering options */
  bwippoptions?: Record<string, unknown>;
  
  /** Setup/configuration mode capabilities */
  setup?: ScannerSetup;
  /** ADF rule programming capabilities */
  adf?: ScannerAdf;
  
  /** Optional function to optimize barcode data (e.g., C40 aggregation) */
  optimizeBarcodeData?: (data: BarcodeData) => BarcodeData;
}

/**
 * Scanner setup mode configuration.
 * Defines the barcodes needed to enter/exit config mode and set options.
 */
export interface ScannerSetup {
  /** Symbology for setup barcodes (may differ from payload) */
  symbology?: string;
  /** Rate for setup barcodes (usually slower than payload) */
  autoRate?: number;
  /** Prefix added to all setup barcodes (e.g., FNC3 for Symbol) */
  prefix: string;
  /** Postfix added to all setup barcodes */
  postfix: string;
  /** Barcodes to enter config mode */
  enterconfig: string[];
  /** Barcodes to exit config mode */
  exitconfig: string[];
  /** Available setup options and their barcode sequences */
  options: Record<string, string[]>;
}

/**
 * Scanner ADF (Advanced Data Formatting) capabilities.
 * Defines how to program pattern-matching rules into the scanner.
 */
export interface ScannerAdf {
  /** Prefix for ADF programming barcodes */
  prefix: string;
  /** Postfix for ADF programming barcodes */
  postfix: string;
  /** Barcodes to start defining a new rule */
  enterconfig: string[];
  /** Barcodes to save the current rule */
  exitconfig: string[];
  /** Barcode to signal end of a text/charmap sequence */
  endmessage?: string;
  /** Available criteria types and their implementations */
  criteria: Record<string, ModelFunction>;
  /** Available action types and their implementations */
  actions: Record<string, ModelFunction | string>;
  /** Character mapping function for encoding text as barcodes */
  mapcharacter?: ModelFunction;
}

/**
 * A model function defines how to generate barcodes for a criteria/action.
 * Can be a simple string (static barcode) or a complex function definition.
 */
export interface ModelFunction {
  /** Function type: 'static' | 'single' | 'multiple' | 'charmap' */
  type?: 'static' | 'single' | 'multiple' | 'charmap';
  /** Prefix for generated barcodes */
  prefix?: string;
  /** Postfix for generated barcodes */
  postfix?: string;
  /** Barcodes to emit before processing */
  enterconfig?: string[];
  /** Barcodes to emit after processing */
  exitconfig?: string[];
  /** Whether to emit endmessage after this function */
  sendendmessage?: boolean;
  /** Processing function for 'single' and 'multiple' types */
  process?: (input: string, adf: ScannerAdf) => string | string[];
}

/**
 * Script type - determines which phase we're generating barcodes for.
 */
export type ScriptType = 'setup' | 'payload';
