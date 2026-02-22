/**
 * barcOwned v2 Main Entry Point
 * 
 * Editor-centric IDE layout with barcode preview sidebar.
 */

import './style.css';
import { BarcOwned, getModel, getModelMetadata, renderToCanvas } from './core';
import type { Payload, BarcodeData } from './core';
import {
  presets,
  loadPayloads,
  createPayload,
  updatePayload,
  importPayloads,
  exportPayloads,
  loadSettings,
  saveSettings,
  loadFromUrl,
  clearUrlHash,
  generateShareUrl,
  renderShareQrCode,
} from './store';
import type { Settings } from './store';

// ============================================
// State
// ============================================

interface AppState {
  currentPayloadId: string | null;
  currentPayload: Payload | null;
  barcodeData: BarcodeData | null;
  setupCount: number;
  payloadCount: number;
  currentBarcodeIndex: number;
  isRunning: boolean;
  runInterval: number | null;
  settings: Settings;
  editorDirty: boolean;
  isPreset: boolean;
  view: 'editor' | 'runner';
}

const state: AppState = {
  currentPayloadId: null,
  currentPayload: null,
  barcodeData: null,
  setupCount: 0,
  payloadCount: 0,
  currentBarcodeIndex: 0,
  isRunning: false,
  runInterval: null,
  settings: loadSettings(),
  editorDirty: false,
  isPreset: false,
  view: 'editor',
};

// CodeMirror editor instance (loaded dynamically)
let editor: any = null;

// ============================================
// DOM Elements
// ============================================

const $ = <T extends HTMLElement>(selector: string): T | null => 
  document.querySelector(selector);

// Layout
const sidebarLeft = $<HTMLElement>('#sidebarLeft')!;
const menuToggle = $<HTMLButtonElement>('#menuToggle')!;
const emptyState = $<HTMLDivElement>('#emptyState')!;
const editorView = $<HTMLDivElement>('#editorView')!;
const runnerView = $<HTMLDivElement>('#runnerView')!;

// Payload list
const payloadList = $<HTMLDivElement>('#payloadList')!;

// Editor header
const payloadNameInput = $<HTMLInputElement>('#payloadNameInput')!;
const barcodeBadge = $<HTMLSpanElement>('#barcodeBadge')!;
const payloadDescription = $<HTMLParagraphElement>('#payloadDescription')!;

// Toolbar
const modelSelect = $<HTMLSelectElement>('#modelSelect')!;

// Editor
const editorContainer = $<HTMLDivElement>('#editorContainer')!;
const statusValidation = $<HTMLSpanElement>('#statusValidation')!;
const statusPosition = $<HTMLSpanElement>('#statusPosition')!;

// Preview
const previewList = $<HTMLDivElement>('#previewList')!;

// Runner
const runnerTitle = $<HTMLElement>('#runnerTitle')!;
const displayModeGroup = $<HTMLDivElement>('#displayModeGroup')!;
const autoRateSelect = $<HTMLSelectElement>('#autoRate')!;
const startDelaySelect = $<HTMLSelectElement>('#startDelay')!;
const barcodeCanvas = $<HTMLCanvasElement>('#barcodeCanvas')!;
const barcodeLabel = $<HTMLDivElement>('#barcodeLabel')!;
const progressFill = $<HTMLDivElement>('#progressFill')!;
const progressText = $<HTMLSpanElement>('#progressText')!;
const prevBtn = $<HTMLButtonElement>('#prevBtn')!;
const nextBtn = $<HTMLButtonElement>('#nextBtn')!;
const startBtn = $<HTMLButtonElement>('#startBtn')!;
const stopBtn = $<HTMLButtonElement>('#stopBtn')!;
const barcodeContainer = $<HTMLDivElement>('#barcodeContainer')!;

// Modals
const shareModal = $<HTMLDialogElement>('#shareModal')!;
const shareQrCanvas = $<HTMLCanvasElement>('#shareQrCanvas')!;
const shareUrl = $<HTMLInputElement>('#shareUrl')!;
const importModal = $<HTMLDialogElement>('#importModal')!;
const importTextarea = $<HTMLTextAreaElement>('#importTextarea')!;

// ============================================
// Mobile Menu Toggle
// ============================================

menuToggle.addEventListener('click', () => {
  sidebarLeft.classList.toggle('open');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && 
      sidebarLeft.classList.contains('open') && 
      !sidebarLeft.contains(e.target as Node) &&
      e.target !== menuToggle) {
    sidebarLeft.classList.remove('open');
  }
});

// ============================================
// Payload List
// ============================================

function renderPayloadList() {
  const userPayloads = loadPayloads();
  
  let html = '<div class="payload-section"><h4>Presets</h4>';
  for (const [id, payload] of Object.entries(presets)) {
    const active = state.currentPayloadId === id ? 'active' : '';
    html += `<div class="payload-item preset ${active}" data-id="${id}">${payload.name}</div>`;
  }
  html += '</div>';
  
  if (userPayloads.length > 0) {
    html += '<div class="payload-section"><h4>My Payloads</h4>';
    for (const stored of userPayloads) {
      const active = state.currentPayloadId === stored.id ? 'active' : '';
      html += `<div class="payload-item ${active}" data-id="${stored.id}">${stored.payload.name}</div>`;
    }
    html += '</div>';
  }
  
  payloadList.innerHTML = html;
  
  // Attach click handlers
  payloadList.querySelectorAll('.payload-item').forEach(item => {
    item.addEventListener('click', () => {
      selectPayload((item as HTMLElement).dataset.id!);
      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        sidebarLeft.classList.remove('open');
      }
    });
  });
}

function selectPayload(id: string) {
  state.currentPayloadId = id;
  
  // Try user payloads first
  const stored = loadPayloads().find(p => p.id === id);
  if (stored) {
    state.currentPayload = stored.payload;
    state.isPreset = false;
  } else if (presets[id]) {
    state.currentPayload = presets[id];
    state.isPreset = true;
  } else {
    return;
  }
  
  // Show editor view
  showView('editor');
  
  // Update header
  payloadNameInput.value = state.currentPayload.name;
  payloadNameInput.readOnly = state.isPreset;
  payloadDescription.textContent = state.currentPayload.description || '';
  
  // Update editor content
  if (editor) {
    const content = JSON.stringify(state.currentPayload, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
  
  // Update barcode data and preview
  updateBarcodeData();
  renderPreview();
  
  // Re-render list to show selection
  renderPayloadList();
  
  state.editorDirty = false;
  updateStatusBar('Ready');
}

// ============================================
// View Management
// ============================================

function showView(view: 'editor' | 'runner') {
  state.view = view;
  
  emptyState.classList.add('hidden');
  editorView.classList.toggle('hidden', view !== 'editor');
  runnerView.classList.toggle('hidden', view !== 'runner');
  
  if (view === 'runner') {
    runnerTitle.textContent = `Running: ${state.currentPayload?.name || 'Payload'}`;
    updateRunnerUI();
  }
}

// ============================================
// Editor
// ============================================

async function initEditor() {
  // Dynamically import CodeMirror
  const { EditorState } = await import('@codemirror/state');
  const { EditorView, keymap, lineNumbers, highlightActiveLine } = await import('@codemirror/view');
  const { json } = await import('@codemirror/lang-json');
  const { oneDark } = await import('@codemirror/theme-one-dark');
  const { defaultKeymap, history, historyKeymap } = await import('@codemirror/commands');
  
  const startState = EditorState.create({
    doc: '{\n  "name": "New Payload",\n  "payload": []\n}',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      json(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          state.editorDirty = true;
          validateAndPreview();
        }
        // Update cursor position
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        statusPosition.textContent = `Ln ${line.number}, Col ${pos - line.from + 1}`;
      }),
    ],
  });

  editor = new EditorView({
    state: startState,
    parent: editorContainer,
  });
}

function validateAndPreview() {
  try {
    const content = editor.state.doc.toString();
    const payload = JSON.parse(content) as Payload;
    
    // Basic validation
    if (!payload.name) throw new Error('Missing "name" field');
    if (!payload.payload || !Array.isArray(payload.payload)) {
      throw new Error('Missing or invalid "payload" array');
    }
    
    state.currentPayload = payload;
    updateStatusBar('✓ Valid JSON', false);
    
    updateBarcodeData();
    renderPreview();
  } catch (e) {
    updateStatusBar(`✗ ${(e as Error).message}`, true);
  }
}

function updateStatusBar(message: string, isError = false) {
  statusValidation.textContent = message;
  statusValidation.classList.toggle('error', isError);
}

function updateBarcodeData() {
  if (!state.currentPayload) {
    barcodeBadge.textContent = '0 barcodes';
    state.barcodeData = null;
    state.setupCount = 0;
    state.payloadCount = 0;
    return;
  }
  
  try {
    const model = getModel(state.settings.modelId);
    const engine = new BarcOwned(model);
    
    // Get counts for labeling
    const setupData = engine.getSetupBarcodeData(state.currentPayload);
    const payloadData = engine.getPayloadBarcodeData(state.currentPayload);
    state.setupCount = setupData.barcodes.length;
    state.payloadCount = payloadData.barcodes.length;
    
    // Get full barcode data
    const data = engine.getBarcodeData(state.currentPayload);
    state.barcodeData = data;
    
    const total = data.barcodes.length;
    barcodeBadge.textContent = `${total} barcode${total !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error('Error generating barcode data:', e);
    barcodeBadge.textContent = 'Error';
    state.barcodeData = null;
  }
}

// ============================================
// Barcode Preview Sidebar
// ============================================

async function renderPreview() {
  if (!state.barcodeData || state.barcodeData.barcodes.length === 0) {
    previewList.innerHTML = '<div class="preview-empty">No barcodes to preview</div>';
    return;
  }
  
  const { barcodes, symbology, BWIPPoptions } = state.barcodeData;
  
  // Build preview HTML
  let html = '';
  for (let i = 0; i < barcodes.length; i++) {
    const isSetup = i < state.setupCount;
    const type = isSetup ? 'setup' : 'payload';
    const typeIndex = isSetup ? i + 1 : i - state.setupCount + 1;
    const typeTotal = isSetup ? state.setupCount : state.payloadCount;
    const label = `${isSetup ? 'Setup' : 'Payload'} ${typeIndex}/${typeTotal}`;
    
    html += `
      <div class="preview-item ${type}">
        <div class="preview-item-header">
          <span class="preview-item-label">${label}</span>
        </div>
        <canvas data-index="${i}"></canvas>
      </div>
    `;
  }
  
  previewList.innerHTML = html;
  
  // Render each barcode to its canvas
  const canvases = previewList.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const index = parseInt((canvas as HTMLCanvasElement).dataset.index!, 10);
    try {
      await renderToCanvas(canvas as HTMLCanvasElement, {
        symbology,
        data: barcodes[index],
        scale: 2,
        ...BWIPPoptions,
      });
    } catch (e) {
      console.error(`Failed to render preview barcode ${index}:`, e);
    }
  }
}

// ============================================
// Editor Actions
// ============================================

$('#saveBtn')?.addEventListener('click', () => {
  if (!state.currentPayload) return;
  
  const content = editor.state.doc.toString();
  try {
    const payload = JSON.parse(content) as Payload;
    payload.name = payloadNameInput.value || payload.name;
    
    // Fork preset or update existing
    if (presets[state.currentPayloadId!]) {
      const stored = createPayload(payload);
      state.currentPayloadId = stored.id;
      state.isPreset = false;
      payloadNameInput.readOnly = false;
    } else if (state.currentPayloadId) {
      updatePayload(state.currentPayloadId, payload);
    } else {
      const stored = createPayload(payload);
      state.currentPayloadId = stored.id;
      state.isPreset = false;
      payloadNameInput.readOnly = false;
    }
    
    state.currentPayload = payload;
    state.editorDirty = false;
    
    renderPayloadList();
    updateStatusBar('✓ Saved', false);
  } catch (e) {
    updateStatusBar(`✗ ${(e as Error).message}`, true);
  }
});

$('#validateBtn')?.addEventListener('click', validateAndPreview);

$('#newPayloadBtn')?.addEventListener('click', () => {
  state.currentPayloadId = null;
  state.isPreset = false;
  state.currentPayload = {
    name: 'New Payload',
    description: '',
    payload: [],
  };
  
  showView('editor');
  
  payloadNameInput.value = 'New Payload';
  payloadNameInput.readOnly = false;
  payloadDescription.textContent = '';
  
  if (editor) {
    const content = JSON.stringify(state.currentPayload, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
  
  updateBarcodeData();
  renderPreview();
  renderPayloadList();
  
  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    sidebarLeft.classList.remove('open');
  }
});

// Name input editing
payloadNameInput.addEventListener('input', () => {
  if (!state.isPreset && state.currentPayload) {
    state.currentPayload.name = payloadNameInput.value;
    state.editorDirty = true;
  }
});

// ============================================
// Import/Export
// ============================================

$('#importBtn')?.addEventListener('click', () => {
  importTextarea.value = '';
  importModal.showModal();
});

$('#importCancelBtn')?.addEventListener('click', () => {
  importModal.close();
});

$('#importConfirmBtn')?.addEventListener('click', () => {
  try {
    const imported = importPayloads(importTextarea.value);
    importModal.close();
    renderPayloadList();
    if (imported.length > 0) {
      selectPayload(imported[0].id);
    }
  } catch (e) {
    alert(`Import failed: ${(e as Error).message}`);
  }
});

$('#exportBtn')?.addEventListener('click', () => {
  const userPayloads = loadPayloads();
  if (userPayloads.length === 0) {
    alert('No user payloads to export');
    return;
  }
  
  const json = exportPayloads();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'barcowned-payloads.json';
  a.click();
  
  URL.revokeObjectURL(url);
});

// ============================================
// Runner
// ============================================

function initRunner() {
  // Populate model select
  const models = getModelMetadata();
  modelSelect.innerHTML = models.map(m => 
    `<option value="${m.id}" ${m.id === state.settings.modelId ? 'selected' : ''}>${m.name}</option>`
  ).join('');
  
  modelSelect.addEventListener('change', () => {
    state.settings = saveSettings({ modelId: modelSelect.value });
    updateBarcodeData();
    renderPreview();
  });
  
  // Display mode buttons
  displayModeGroup.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
      displayModeGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.settings = saveSettings({ displayMode: (btn as HTMLElement).dataset.value as any });
      updateRunnerUI();
    });
  });
  
  // Auto rate
  autoRateSelect.addEventListener('change', () => {
    state.settings = saveSettings({ autoRate: parseFloat(autoRateSelect.value) });
  });
  
  // Start delay
  startDelaySelect.addEventListener('change', () => {
    state.settings = saveSettings({ startDelay: parseInt(startDelaySelect.value) });
  });
}

function updateRunnerUI() {
  const mode = state.settings.displayMode;
  
  // Show/hide mode-specific controls
  document.querySelectorAll('[data-show-for]').forEach(el => {
    const showFor = (el as HTMLElement).dataset.showFor;
    (el as HTMLElement).style.display = showFor === mode ? '' : 'none';
  });
  
  // Update nav visibility
  const showNav = mode === 'manual';
  prevBtn.classList.toggle('hidden', !showNav);
  nextBtn.classList.toggle('hidden', !showNav);
  
  // Update progress
  if (state.barcodeData) {
    const total = state.barcodeData.barcodes.length;
    progressText.textContent = `0 / ${total}`;
    progressFill.style.width = '0%';
  }
}

$('#runBtn')?.addEventListener('click', () => {
  if (!state.barcodeData || state.barcodeData.barcodes.length === 0) {
    alert('No barcodes to display. Select a payload first.');
    return;
  }
  showView('runner');
  state.currentBarcodeIndex = 0;
  updateRunnerUI();
});

$('#backToEditorBtn')?.addEventListener('click', () => {
  stopRun();
  showView('editor');
});

startBtn.addEventListener('click', startRun);
stopBtn.addEventListener('click', stopRun);

prevBtn.addEventListener('click', () => {
  if (state.currentBarcodeIndex > 0) {
    state.currentBarcodeIndex--;
    renderCurrentBarcode();
  }
});

nextBtn.addEventListener('click', () => {
  if (state.barcodeData && state.currentBarcodeIndex < state.barcodeData.barcodes.length - 1) {
    state.currentBarcodeIndex++;
    renderCurrentBarcode();
  }
});

function startRun() {
  if (!state.barcodeData || state.barcodeData.barcodes.length === 0) return;
  
  state.isRunning = true;
  state.currentBarcodeIndex = 0;
  
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  
  const mode = state.settings.displayMode;
  
  if (mode === 'auto') {
    const delay = state.settings.startDelay * 1000;
    setTimeout(() => {
      if (!state.isRunning) return;
      renderCurrentBarcode();
      
      const intervalMs = 1000 / state.settings.autoRate;
      state.runInterval = window.setInterval(() => {
        state.currentBarcodeIndex++;
        if (state.currentBarcodeIndex >= state.barcodeData!.barcodes.length) {
          stopRun();
        } else {
          renderCurrentBarcode();
        }
      }, intervalMs);
    }, delay);
  } else if (mode === 'manual') {
    renderCurrentBarcode();
  }
}

function stopRun() {
  state.isRunning = false;
  
  if (state.runInterval) {
    clearInterval(state.runInterval);
    state.runInterval = null;
  }
  
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
}

function renderCurrentBarcode() {
  if (!state.barcodeData) return;
  
  const data = state.barcodeData;
  const index = state.currentBarcodeIndex;
  const total = data.barcodes.length;
  
  // Update progress
  progressFill.style.width = `${((index + 1) / total) * 100}%`;
  progressText.textContent = `${index + 1} / ${total}`;
  
  // Update label
  const isSetup = index < state.setupCount;
  const typeIndex = isSetup ? index + 1 : index - state.setupCount + 1;
  const typeTotal = isSetup ? state.setupCount : state.payloadCount;
  barcodeLabel.textContent = `${isSetup ? 'Setup' : 'Payload'} ${typeIndex}/${typeTotal}`;
  
  // Render barcode
  renderToCanvas(barcodeCanvas, {
    symbology: data.symbology,
    data: data.barcodes[index],
    scale: 4,
    ...data.BWIPPoptions,
  }).catch(e => {
    console.error('Render error:', e);
  });
  
  // Update nav buttons
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === total - 1;
}

// Fullscreen on click
barcodeContainer.addEventListener('click', () => {
  if (state.barcodeData && state.barcodeData.barcodes.length > 0) {
    barcodeContainer.requestFullscreen?.();
  }
});

// ============================================
// Share
// ============================================

$('#shareBtn')?.addEventListener('click', async () => {
  if (!state.currentPayload) {
    alert('Select a payload first');
    return;
  }
  
  const url = generateShareUrl(state.currentPayload, state.settings);
  shareUrl.value = url;
  
  // Render QR code
  try {
    await renderShareQrCode(shareQrCanvas, url);
  } catch (e) {
    console.error('Failed to render QR code:', e);
  }
  
  shareModal.showModal();
});

$('#shareCloseBtn')?.addEventListener('click', () => {
  shareModal.close();
});

$('#copyUrlBtn')?.addEventListener('click', () => {
  if (shareUrl.value) {
    navigator.clipboard.writeText(shareUrl.value);
    ($('#copyUrlBtn') as HTMLButtonElement).textContent = 'Copied!';
    setTimeout(() => {
      ($('#copyUrlBtn') as HTMLButtonElement).textContent = 'Copy';
    }, 1500);
  }
});

// Close modal on backdrop click
shareModal.addEventListener('click', (e) => {
  if (e.target === shareModal) {
    shareModal.close();
  }
});

// ============================================
// Initialization
// ============================================

async function init() {
  // Check for shared payload in URL
  const shared = loadFromUrl();
  if (shared) {
    const stored = createPayload(shared.payload);
    if (shared.settings) {
      state.settings = saveSettings(shared.settings);
    }
    clearUrlHash();
    await initEditor();
    initRunner();
    renderPayloadList();
    selectPayload(stored.id);
    return;
  }
  
  // Initialize components
  await initEditor();
  initRunner();
  renderPayloadList();
  
  // Default: select "Hello World" preset
  const defaultPresetId = Object.keys(presets)[0];
  if (defaultPresetId) {
    selectPayload(defaultPresetId);
  }
}

init().catch(console.error);
