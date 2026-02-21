/**
 * barcOwned v2 Main Entry Point
 * 
 * Initializes the app, wires up event handlers, and manages state.
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
  generateQrCodeUrl,
} from './store';
import type { Settings } from './store';

// ============================================
// State
// ============================================

interface AppState {
  currentPayloadId: string | null;
  currentPayload: Payload | null;
  barcodeData: BarcodeData | null;
  currentBarcodeIndex: number;
  isRunning: boolean;
  runInterval: number | null;
  settings: Settings;
  editorDirty: boolean;
}

const state: AppState = {
  currentPayloadId: null,
  currentPayload: null,
  barcodeData: null,
  currentBarcodeIndex: 0,
  isRunning: false,
  runInterval: null,
  settings: loadSettings(),
  editorDirty: false,
};

// CodeMirror editor instance (loaded dynamically)
let editor: any = null;

// ============================================
// DOM Elements
// ============================================

const $ = <T extends HTMLElement>(selector: string): T | null => 
  document.querySelector(selector);

const $$ = <T extends HTMLElement>(selector: string): T[] => 
  Array.from(document.querySelectorAll(selector));

// Navigation
const navTabs = $$<HTMLButtonElement>('.nav-tab');
const panels = $$<HTMLElement>('.panel');

// Editor
const payloadList = $<HTMLDivElement>('#payloadList')!;
const payloadNameInput = $<HTMLInputElement>('#payloadName')!;
const editorContainer = $<HTMLDivElement>('#editorContainer')!;
const editorStatus = $<HTMLDivElement>('#editorStatus')!;
const previewBarcodes = $<HTMLDivElement>('#previewBarcodes')!;
const previewCount = $<HTMLSpanElement>('#previewCount')!;

// Runner
const modelSelect = $<HTMLSelectElement>('#modelSelect')!;
const displayModeGroup = $<HTMLDivElement>('#displayModeGroup')!;
const autoRateSelect = $<HTMLSelectElement>('#autoRate')!;
const startDelaySelect = $<HTMLSelectElement>('#startDelay')!;
const runBtn = $<HTMLButtonElement>('#runBtn')!;
const stopBtn = $<HTMLButtonElement>('#stopBtn')!;
const barcodeCanvas = $<HTMLCanvasElement>('#barcodeCanvas')!;
const barcodePlaceholder = $<HTMLDivElement>('#barcodePlaceholder')!;
const progressFill = $<HTMLDivElement>('#progressFill')!;
const progressText = $<HTMLSpanElement>('#progressText')!;
const runnerNav = $<HTMLDivElement>('#runnerNav')!;
const prevBtn = $<HTMLButtonElement>('#prevBtn')!;
const nextBtn = $<HTMLButtonElement>('#nextBtn')!;
const barcodeContainer = $<HTMLDivElement>('#barcodeContainer')!;

// Share
const shareQrCode = $<HTMLImageElement>('#shareQrCode')!;
const shareUrl = $<HTMLInputElement>('#shareUrl')!;

// Modals
const importModal = $<HTMLDialogElement>('#importModal')!;
const importTextarea = $<HTMLTextAreaElement>('#importTextarea')!;

// ============================================
// Navigation
// ============================================

function switchTab(tabId: string) {
  navTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
  panels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabId));
}

navTabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab!));
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
    item.addEventListener('click', () => selectPayload((item as HTMLElement).dataset.id!));
  });
}

function selectPayload(id: string) {
  state.currentPayloadId = id;
  
  // Try user payloads first
  const stored = loadPayloads().find(p => p.id === id);
  if (stored) {
    state.currentPayload = stored.payload;
  } else if (presets[id]) {
    state.currentPayload = presets[id];
  } else {
    return;
  }
  
  // Update editor
  payloadNameInput.value = state.currentPayload.name;
  if (editor) {
    const content = JSON.stringify(state.currentPayload, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
  
  // Update preview
  updatePreview();
  
  // Re-render list to show selection
  renderPayloadList();
  
  state.editorDirty = false;
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
    editorStatus.textContent = '✓ Valid JSON';
    editorStatus.className = 'editor-status success';
    
    updatePreview();
  } catch (e) {
    editorStatus.textContent = `✗ ${(e as Error).message}`;
    editorStatus.className = 'editor-status error';
  }
}

function updatePreview() {
  if (!state.currentPayload) {
    previewBarcodes.innerHTML = '';
    previewCount.textContent = '0 barcodes';
    return;
  }
  
  try {
    const model = getModel(state.settings.modelId);
    const engine = new BarcOwned(model);
    const data = engine.getBarcodeData(state.currentPayload);
    
    state.barcodeData = data;
    previewCount.textContent = `${data.barcodes.length} barcodes`;
    
    // Render preview barcodes (limit to 10)
    previewBarcodes.innerHTML = '';
    const limit = Math.min(data.barcodes.length, 10);
    
    for (let i = 0; i < limit; i++) {
      const container = document.createElement('div');
      container.className = 'preview-barcode';
      
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      previewBarcodes.appendChild(container);
      
      renderToCanvas(canvas, {
        symbology: data.symbology,
        data: data.barcodes[i],
        scale: 2,
        ...data.BWIPPoptions,
      }).catch(e => {
        console.error('Preview render error:', e);
        container.innerHTML = `<span style="color: red">Error: ${data.barcodes[i].slice(0, 20)}...</span>`;
      });
    }
    
    if (data.barcodes.length > limit) {
      const more = document.createElement('div');
      more.className = 'preview-more';
      more.textContent = `+ ${data.barcodes.length - limit} more...`;
      previewBarcodes.appendChild(more);
    }
  } catch (e) {
    console.error('Preview error:', e);
  }
}

// Editor actions
$('#saveBtn')?.addEventListener('click', () => {
  if (!state.currentPayload) return;
  
  const content = editor.state.doc.toString();
  try {
    const payload = JSON.parse(content) as Payload;
    payload.name = payloadNameInput.value || payload.name;
    
    // Check if it's a preset (fork it) or existing user payload (update it)
    if (presets[state.currentPayloadId!]) {
      const stored = createPayload(payload);
      state.currentPayloadId = stored.id;
    } else if (state.currentPayloadId) {
      updatePayload(state.currentPayloadId, payload);
    } else {
      const stored = createPayload(payload);
      state.currentPayloadId = stored.id;
    }
    
    state.currentPayload = payload;
    state.editorDirty = false;
    renderPayloadList();
    editorStatus.textContent = '✓ Saved';
    editorStatus.className = 'editor-status success';
  } catch (e) {
    editorStatus.textContent = `✗ ${(e as Error).message}`;
    editorStatus.className = 'editor-status error';
  }
});

$('#newPayloadBtn')?.addEventListener('click', () => {
  state.currentPayloadId = null;
  state.currentPayload = {
    name: 'New Payload',
    description: '',
    payload: [],
  };
  
  payloadNameInput.value = 'New Payload';
  if (editor) {
    const content = JSON.stringify(state.currentPayload, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
  
  renderPayloadList();
});

$('#validateBtn')?.addEventListener('click', validateAndPreview);

// Import/Export
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
    updatePreview();
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
  
  // Fullscreen on click
  barcodeContainer.addEventListener('click', () => {
    if (state.barcodeData && state.barcodeData.barcodes.length > 0) {
      barcodeContainer.requestFullscreen?.();
    }
  });
}

function updateRunnerUI() {
  const mode = state.settings.displayMode;
  
  // Show/hide mode-specific controls
  document.querySelectorAll('[data-show-for]').forEach(el => {
    const showFor = (el as HTMLElement).dataset.showFor;
    (el as HTMLElement).style.display = showFor === mode ? '' : 'none';
  });
  
  // Show/hide manual nav
  runnerNav.classList.toggle('hidden', mode !== 'manual' || !state.isRunning);
}

function startRun() {
  if (!state.barcodeData || state.barcodeData.barcodes.length === 0) {
    alert('No barcodes to display. Select a payload first.');
    return;
  }
  
  state.isRunning = true;
  state.currentBarcodeIndex = 0;
  
  runBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  barcodePlaceholder.classList.add('hidden');
  
  updateRunnerUI();
  
  const mode = state.settings.displayMode;
  
  if (mode === 'auto') {
    // Start delay
    const delay = state.settings.startDelay * 1000;
    setTimeout(() => {
      if (!state.isRunning) return;
      renderCurrentBarcode();
      
      // Start auto-advance
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
  } else if (mode === 'list') {
    renderAllBarcodes();
  }
}

function stopRun() {
  state.isRunning = false;
  
  if (state.runInterval) {
    clearInterval(state.runInterval);
    state.runInterval = null;
  }
  
  runBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  runnerNav.classList.add('hidden');
}

function renderCurrentBarcode() {
  if (!state.barcodeData) return;
  
  const data = state.barcodeData;
  const index = state.currentBarcodeIndex;
  const total = data.barcodes.length;
  
  // Update progress
  progressFill.style.width = `${((index + 1) / total) * 100}%`;
  progressText.textContent = `${index + 1} / ${total}`;
  
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

function renderAllBarcodes() {
  // TODO: Implement list mode - render all barcodes for printing
  alert('List mode coming soon!');
  stopRun();
}

runBtn.addEventListener('click', startRun);
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

// ============================================
// Share
// ============================================

$('#generateShareBtn')?.addEventListener('click', () => {
  if (!state.currentPayload) {
    alert('Select a payload first');
    return;
  }
  
  const url = generateShareUrl(state.currentPayload, state.settings);
  shareUrl.value = url;
  shareQrCode.src = generateQrCodeUrl(url);
});

$('#copyUrlBtn')?.addEventListener('click', () => {
  shareUrl.select();
  navigator.clipboard.writeText(shareUrl.value);
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
    renderPayloadList();
    selectPayload(stored.id);
    switchTab('runner');
    return;
  }
  
  // Initialize components
  await initEditor();
  initRunner();
  renderPayloadList();
  
  // Select first preset by default
  const firstPreset = Object.keys(presets)[0];
  if (firstPreset) {
    selectPayload(firstPreset);
  }
}

init().catch(console.error);
