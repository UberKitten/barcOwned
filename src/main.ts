/**
 * barcOwned v2 Main Entry Point
 * 
 * Single-page layout with sidebar navigation.
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
  currentBarcodeIndex: number;
  isRunning: boolean;
  runInterval: number | null;
  settings: Settings;
  editorDirty: boolean;
  isPreset: boolean;
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
  isPreset: false,
};

// CodeMirror editor instance (loaded dynamically)
let editor: any = null;

// ============================================
// DOM Elements
// ============================================

const $ = <T extends HTMLElement>(selector: string): T | null => 
  document.querySelector(selector);

// Layout
const sidebar = $<HTMLElement>('#sidebar')!;
const menuToggle = $<HTMLButtonElement>('#menuToggle')!;
const emptyState = $<HTMLDivElement>('#emptyState')!;
const payloadView = $<HTMLDivElement>('#payloadView')!;

// Payload list
const payloadList = $<HTMLDivElement>('#payloadList')!;

// Payload header
const payloadTitle = $<HTMLElement>('#payloadTitle')!;
const payloadBadge = $<HTMLSpanElement>('#payloadBadge')!;

// Editor section
const editorSection = $<HTMLElement>('#editorSection')!;
const editorToggle = $<HTMLButtonElement>('#editorToggle')!;
const editorBadge = $<HTMLSpanElement>('#editorBadge')!;
const payloadNameInput = $<HTMLInputElement>('#payloadName')!;
const editorContainer = $<HTMLDivElement>('#editorContainer')!;
const editorStatus = $<HTMLDivElement>('#editorStatus')!;

// Runner section
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
const prevBtn = $<HTMLButtonElement>('#prevBtn')!;
const nextBtn = $<HTMLButtonElement>('#nextBtn')!;
const barcodeContainer = $<HTMLDivElement>('#barcodeContainer')!;

// Share section
const shareQrCanvas = $<HTMLCanvasElement>('#shareQrCanvas')!;
const shareQrPlaceholder = $<HTMLDivElement>('#shareQrPlaceholder')!;
const shareUrl = $<HTMLInputElement>('#shareUrl')!;

// Modals
const importModal = $<HTMLDialogElement>('#importModal')!;
const importTextarea = $<HTMLTextAreaElement>('#importTextarea')!;

// ============================================
// Mobile Menu Toggle
// ============================================

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && 
      sidebar.classList.contains('open') && 
      !sidebar.contains(e.target as Node) &&
      e.target !== menuToggle) {
    sidebar.classList.remove('open');
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
        sidebar.classList.remove('open');
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
  
  // Show payload view, hide empty state
  emptyState.classList.add('hidden');
  payloadView.classList.remove('hidden');
  
  // Update header
  payloadTitle.textContent = state.currentPayload.name;
  
  // Update editor
  payloadNameInput.value = state.currentPayload.name;
  if (editor) {
    const content = JSON.stringify(state.currentPayload, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
  
  // Set editor section collapsed for presets, expanded for user payloads
  if (state.isPreset) {
    editorSection.classList.remove('expanded');
  } else {
    editorSection.classList.add('expanded');
  }
  
  // Update barcode data
  updateBarcodeData();
  
  // Re-render list to show selection
  renderPayloadList();
  
  // Reset share section
  shareQrPlaceholder.classList.remove('hidden');
  shareUrl.value = '';
  
  state.editorDirty = false;
}

// ============================================
// Editor Section
// ============================================

// Toggle editor section
editorToggle.addEventListener('click', () => {
  editorSection.classList.toggle('expanded');
});

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
    
    updateBarcodeData();
  } catch (e) {
    editorStatus.textContent = `✗ ${(e as Error).message}`;
    editorStatus.className = 'editor-status error';
  }
}

function updateBarcodeData() {
  if (!state.currentPayload) {
    payloadBadge.textContent = '0 barcodes';
    editorBadge.textContent = '0 barcodes';
    return;
  }
  
  try {
    const model = getModel(state.settings.modelId);
    const engine = new BarcOwned(model);
    const data = engine.getBarcodeData(state.currentPayload);
    
    state.barcodeData = data;
    const count = data.barcodes.length;
    const label = `${count} barcode${count !== 1 ? 's' : ''}`;
    payloadBadge.textContent = label;
    editorBadge.textContent = label;
    
    // Reset progress
    progressFill.style.width = '0%';
    progressText.textContent = `0 / ${count}`;
  } catch (e) {
    console.error('Error generating barcode data:', e);
    payloadBadge.textContent = 'Error';
    editorBadge.textContent = 'Error';
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
      state.isPreset = false;
    } else if (state.currentPayloadId) {
      updatePayload(state.currentPayloadId, payload);
    } else {
      const stored = createPayload(payload);
      state.currentPayloadId = stored.id;
      state.isPreset = false;
    }
    
    state.currentPayload = payload;
    state.editorDirty = false;
    
    // Update title
    payloadTitle.textContent = payload.name;
    
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
  state.isPreset = false;
  state.currentPayload = {
    name: 'New Payload',
    description: '',
    payload: [],
  };
  
  // Show payload view
  emptyState.classList.add('hidden');
  payloadView.classList.remove('hidden');
  
  // Update header
  payloadTitle.textContent = 'New Payload';
  
  // Expand editor for new payloads
  editorSection.classList.add('expanded');
  
  payloadNameInput.value = 'New Payload';
  if (editor) {
    const content = JSON.stringify(state.currentPayload, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
  }
  
  updateBarcodeData();
  renderPayloadList();
  
  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
  }
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
// Runner Section
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
    if (state.barcodeData && state.barcodeData.barcodes.length > 0 && !state.isRunning) {
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
  
  // Update nav button visibility based on mode and running state
  if (mode === 'manual' && state.isRunning) {
    prevBtn.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
  } else {
    prevBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
  }
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
  prevBtn.classList.add('hidden');
  nextBtn.classList.add('hidden');
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
// Share Section
// ============================================

$('#generateShareBtn')?.addEventListener('click', async () => {
  if (!state.currentPayload) {
    alert('Select a payload first');
    return;
  }
  
  const url = generateShareUrl(state.currentPayload, state.settings);
  shareUrl.value = url;
  
  // Render QR code locally using bwip-js
  try {
    await renderShareQrCode(shareQrCanvas, url);
    shareQrPlaceholder.classList.add('hidden');
  } catch (e) {
    console.error('Failed to render QR code:', e);
    shareQrPlaceholder.textContent = 'Failed to generate QR';
  }
});

$('#copyUrlBtn')?.addEventListener('click', () => {
  if (shareUrl.value) {
    navigator.clipboard.writeText(shareUrl.value);
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
  updateRunnerUI();
  
  // Start with empty state visible (no payload selected)
}

init().catch(console.error);
