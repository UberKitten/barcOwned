/**
 * Scanner Model Registry
 * 
 * This file exports all available scanner models.
 * To add support for a new scanner:
 * 
 * 1. Create a new file in this directory (e.g., honeywell.ts)
 * 2. Define a ScannerModel object with the scanner's capabilities
 * 3. Export it from this index file
 * 
 * See symbol.ts for a complete example with ADF support.
 */

import { symbolModel } from './symbol';
import type { ScannerModel } from '../types';

/**
 * All available scanner models, keyed by ID.
 */
export const models: Record<string, ScannerModel> = {
  symbol: symbolModel,
};

/**
 * Get a scanner model by ID.
 * @throws if model not found
 */
export function getModel(id: string): ScannerModel {
  const model = models[id];
  if (!model) {
    throw new Error(`Unknown scanner model: ${id}. Available: ${Object.keys(models).join(', ')}`);
  }
  return model;
}

/**
 * List all available model IDs.
 */
export function listModels(): string[] {
  return Object.keys(models);
}

/**
 * Get metadata for all models (for UI display).
 */
export function getModelMetadata(): Array<{ id: string; name: string }> {
  return Object.entries(models).map(([id, model]) => ({
    id,
    name: model.name,
  }));
}

export { symbolModel };
