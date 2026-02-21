/**
 * barcOwned Core Module
 * 
 * This module contains the barcode engine - the logic that transforms
 * payload definitions into actual barcode data.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { BarcOwned, getModel, renderToCanvas } from './core';
 * 
 * // Load a scanner model
 * const model = getModel('symbol');
 * 
 * // Create engine instance
 * const engine = new BarcOwned(model);
 * 
 * // Define a payload
 * const payload = {
 *   name: 'Hello World',
 *   setup: {
 *     rules: [{
 *       criteria: [['stringatstart', 'hello']],
 *       actions: [['sendremaining'], ['sendtext', 'world']]
 *     }]
 *   },
 *   payload: ['hello']
 * };
 * 
 * // Generate barcode data
 * const data = engine.getBarcodeData(payload);
 * 
 * // Render each barcode
 * for (const barcode of data.barcodes) {
 *   await renderToCanvas(canvas, {
 *     symbology: data.symbology,
 *     data: barcode,
 *     ...data.BWIPPoptions
 *   });
 * }
 * ```
 */

// Core engine
export { BarcOwned } from './barcowned';

// Types
export type {
  Payload,
  PayloadSetup,
  AdfRule,
  AdfCriteria,
  AdfAction,
  BarcodeData,
  ScannerModel,
  ScannerSetup,
  ScannerAdf,
  ModelFunction,
  ScriptType,
} from './types';

// Scanner models
export { models, getModel, listModels, getModelMetadata } from './models';
export { symbolModel } from './models/symbol';

// Rendering
export {
  renderToCanvas,
  renderToDataURL,
  estimateDimensions,
  is2D,
} from './render';
export type { RenderOptions } from './render';
