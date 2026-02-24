/**
 * barcOwned v2 Main Entry Point
 * 
 * Editor-centric IDE layout with barcode preview sidebar.
 */

import './style.css';
import { BarcOwned, getModel, getModelMetadata, renderToCanvas } from './core';
import JSZip from 'jszip';
import type { Payload, BarcodeData } from './core';
import {
  presets,
  loadPayloads,
  createPayload,
  updatePayload,
  importPayloads,
  exportPayloads,
  deletePayload,
  loadDrafts,
  saveDraft,
  deleteDraft,
  loadSettings,
  saveSettings,
  loadFromUrl,
  clearUrlHash,
  generateShareUrl,
  renderShareQrCode,
} from './store';
import type { Settings } from './store';
import {
  iconMenu,
  iconScanBarcode,
  iconSave,
  iconPlay,
  iconPause,
  iconShare,
  iconChevronLeft,
  iconChevronRight,
  iconPackage,
  iconPlus,
  iconMinus,
  iconMaximize,
  iconImport,
  iconExport,
  iconCopy,
  iconUndo,
  iconArrowLeft,
  iconPanelRight,
  iconX,
  iconTrash,
} from './icons';

// ============================================
// State
// ============================================

interface AppState {
  currentPayloadId: string | null;
  currentBaseId: string | null;
  currentBaseType: 'preset' | 'user' | 'new' | null;
  baseText: string;
  currentText: string;
  currentPayload: Payload | null;
  barcodeData: BarcodeData | null;
  setupCount: number;
  payloadCount: number;
  currentBarcodeIndex: number;
  isRunning: boolean;
  playbackTimeout: number | null;
  nextAdvanceAt: number | null;
  remainingMs: number | null;
  timeRaf: number | null;
  settings: Settings;
  editorDirty: boolean;
  view: 'editor' | 'runner';
  pendingDeleteId: string | null;
}

const state: AppState = {
  currentPayloadId: null,
  currentBaseId: null,
  currentBaseType: null,
  baseText: '',
  currentText: '',
  currentPayload: null,
  barcodeData: null,
  setupCount: 0,
  payloadCount: 0,
  currentBarcodeIndex: 0,
  isRunning: false,
  playbackTimeout: null,
  nextAdvanceAt: null,
  remainingMs: null,
  timeRaf: null,
  settings: loadSettings(),
  editorDirty: false,
  view: 'editor',
  pendingDeleteId: null,
};

// CodeMirror editor instance (loaded dynamically)
let editor: any = null;
let suppressEditorChange = false;

// ============================================
// DOM Elements
// ============================================

const $ = <T extends HTMLElement>(selector: string): T | null => 
  document.querySelector(selector);

// Layout
const sidebarLeft = $<HTMLElement>('#sidebarLeft')!;
const sidebarRight = $<HTMLElement>('#sidebarRight')!;
const menuToggle = $<HTMLButtonElement>('#menuToggle')!;
const emptyState = $<HTMLDivElement>('#emptyState')!;
const editorView = $<HTMLDivElement>('#editorView')!;
const runnerView = $<HTMLDivElement>('#runnerView')!;

// Payload list
const payloadList = $<HTMLDivElement>('#payloadList')!;

// Editor header
const payloadNameInput = $<HTMLInputElement>('#payloadNameInput')!;
const payloadDescriptionInput = $<HTMLTextAreaElement>('#payloadDescriptionInput')!;
const barcodeBadge = $<HTMLSpanElement>('#barcodeBadge')!;

// Toolbar
const modelSelect = $<HTMLSelectElement>('#modelSelect')!;
const saveDirtyDot = $<HTMLSpanElement>('#saveDirtyDot')!;
const discardBtn = $<HTMLButtonElement>('#discardBtn')!;

// Editor
const editorContainer = $<HTMLDivElement>('#editorContainer')!;
const editorStatusbar = $<HTMLDivElement>('#editorStatusbar')!;
const statusValidation = $<HTMLSpanElement>('#statusValidation')!;
const statusPosition = $<HTMLSpanElement>('#statusPosition')!;

// Preview
const previewList = $<HTMLDivElement>('#previewList')!;
const previewToggle = $<HTMLButtonElement>('#previewToggle')!;
const previewBtn = $<HTMLButtonElement>('#previewBtn')!;
const previewModeSelect = $<HTMLSelectElement>('#previewMode')!;

// Runner
const runnerTitle = $<HTMLElement>('#runnerTitle')!;
const runnerMessage = $<HTMLDivElement>('#runnerMessage')!;
const autoRateSelect = $<HTMLSelectElement>('#autoRate')!;
const startDelaySelect = $<HTMLSelectElement>('#startDelay')!;
const runnerBarcodeModeSelect = $<HTMLSelectElement>('#runnerBarcodeMode')!;
const sizeMinusBtn = $<HTMLButtonElement>('#sizeMinusBtn')!;
const sizePlusBtn = $<HTMLButtonElement>('#sizePlusBtn')!;
const sizeFullscreenBtn = $<HTMLButtonElement>('#sizeFullscreenBtn')!;
const sizeValue = $<HTMLSpanElement>('#sizeValue')!;
const playPauseBtn = $<HTMLButtonElement>('#playPauseBtn')!;
const barcodeCanvas = $<HTMLCanvasElement>('#barcodeCanvas')!;
const barcodeLabel = $<HTMLDivElement>('#barcodeLabel')!;
const barcodeComment = $<HTMLDivElement>('#barcodeComment')!;
const progressFill = $<HTMLDivElement>('#progressFill')!;
const progressText = $<HTMLSpanElement>('#progressText')!;
const timeText = $<HTMLSpanElement>('#timeText')!;
const timeProgressFill = $<HTMLDivElement>('#timeProgressFill')!;
const prevBtn = $<HTMLButtonElement>('#prevBtn')!;
const nextBtn = $<HTMLButtonElement>('#nextBtn')!;
const barcodeContainer = $<HTMLDivElement>('#barcodeContainer')!;

// Modals
const shareModal = $<HTMLDialogElement>('#shareModal')!;
const shareQrCanvas = $<HTMLCanvasElement>('#shareQrCanvas')!;
const shareSizeMinusBtn = $<HTMLButtonElement>('#shareSizeMinusBtn')!;
const shareSizePlusBtn = $<HTMLButtonElement>('#shareSizePlusBtn')!;
const shareSizeValue = $<HTMLSpanElement>('#shareSizeValue')!;
const shareUrl = $<HTMLInputElement>('#shareUrl')!;
const importModal = $<HTMLDialogElement>('#importModal')!;
const importTextarea = $<HTMLTextAreaElement>('#importTextarea')!;
const importFiles = $<HTMLInputElement>('#importFiles')!;
const importError = $<HTMLDivElement>('#importError')!;
const exportBtn = $<HTMLButtonElement>('#exportBtn')!;
const exportAllBtn = $<HTMLButtonElement>('#exportAllBtn')!;
const deleteModal = $<HTMLDialogElement>('#deleteModal')!;
const deleteCloseBtn = $<HTMLButtonElement>('#deleteCloseBtn')!;
const deleteCancelBtn = $<HTMLButtonElement>('#deleteCancelBtn')!;
const deleteConfirmBtn = $<HTMLButtonElement>('#deleteConfirmBtn')!;
const deleteMessage = $<HTMLParagraphElement>('#deleteMessage')!;

// ============================================
// Inline Feedback Utilities
// ============================================

function showImportError(message: string) {
  importError.textContent = message;
  importError.classList.remove('hidden');
}

function hideImportError() {
  importError.textContent = '';
  importError.classList.add('hidden');
}

function showRunnerMessage(message: string, isError = false) {
  runnerMessage.textContent = message;
  runnerMessage.classList.toggle('error', isError);
  runnerMessage.classList.remove('hidden');
}

function hideRunnerMessage() {
  runnerMessage.classList.add('hidden');
}

// ============================================
// Drafts + Dirty State
// ============================================

const DRAFT_SAVE_DELAY = 250;
let draftSaveTimer: number | null = null;
let setDirtyLinesEffect: any = null;

const broadcast = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('barcowned-state')
  : null;

function emitStateChange() {
  try {
    broadcast?.postMessage({ type: 'state-change' });
  } catch {
    // ignore
  }
}

function getDraftId(baseType: 'preset' | 'user' | 'new', baseId?: string): string {
  if (baseType === 'new') return baseId ?? `draft:${Math.random().toString(36).slice(2, 10)}`;
  return `${baseType}:${baseId}`;
}

function saveEditorScroll() {
  if (!state.currentBaseType) return;
  const draftId = state.currentBaseType === 'new'
    ? (state.currentBaseId ?? getDraftId('new'))
    : getDraftId(state.currentBaseType, state.currentBaseId!);

  const existing = loadDrafts().find(d => d.id === draftId);
  if (!existing) return;
  existing.scrollTop = editor?.scrollDOM?.scrollTop ?? 0;
  saveDraft(existing);
}

function getBaseTextFromPayload(payload: Payload): string {
  return JSON.stringify(payload, null, 2);
}

function setDirtyState(isDirty: boolean) {
  state.editorDirty = isDirty;
  saveDirtyDot.classList.toggle('hidden', !isDirty);
  discardBtn.disabled = !isDirty;
  renderPayloadList();
  updateDirtyLineMarkers();
}

function updateDirtyLineMarkers() {
  if (!editor || !setDirtyLinesEffect) return;
  const baseLines = state.baseText.split('\n');
  const currentLines = state.currentText.split('\n');
  const max = Math.max(baseLines.length, currentLines.length);
  const dirtyLines: number[] = [];
  for (let i = 0; i < max; i++) {
    if (baseLines[i] !== currentLines[i]) dirtyLines.push(i + 1);
  }
  editor.dispatch({ effects: setDirtyLinesEffect.of(dirtyLines) });
}

function persistDraftNow() {
  if (!state.currentBaseType) return;
  const draftId = state.currentBaseType === 'new'
    ? (state.currentBaseId ?? getDraftId('new'))
    : getDraftId(state.currentBaseType, state.currentBaseId!);

  state.currentBaseId = state.currentBaseId ?? draftId;

  const scrollTop = editor?.scrollDOM?.scrollTop ?? 0;
  const text = state.editorDirty || state.currentBaseType === 'new'
    ? state.currentText
    : state.baseText;

  saveDraft({
    id: draftId,
    baseId: state.currentBaseType === 'new' ? undefined : state.currentBaseId!,
    baseType: state.currentBaseType,
    text,
    scrollTop,
    updatedAt: Date.now(),
  });
  emitStateChange();
}

function scheduleDraftSave() {
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    persistDraftNow();
  }, DRAFT_SAVE_DELAY);
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_]+/gi, '_').slice(0, 80) || 'payload';
}

function refreshFromStorage() {
  renderPayloadList();
  updateExportButtonState();

  if (!state.currentBaseType || state.editorDirty) return;

  if (state.currentBaseType === 'new') {
    const draft = loadDrafts().find(d => d.id === state.currentBaseId);
    if (draft) {
      state.currentText = draft.text;
      if (editor) {
        suppressEditorChange = true;
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: draft.text }
        });
        editor.scrollDOM.scrollTop = draft.scrollTop ?? 0;
        suppressEditorChange = false;
      }
      payloadDescriptionInput.value = (() => {
        try {
          return (JSON.parse(draft.text) as Payload).description || '';
        } catch {
          return '';
        }
      })();
    }
    return;
  }

  const basePayload = state.currentBaseType === 'user'
    ? loadPayloads().find(p => p.id === state.currentBaseId)?.payload
    : presets[state.currentBaseId!];

  if (!basePayload) return;

  const baseText = getBaseTextFromPayload(basePayload);
  const draftId = getDraftId(state.currentBaseType, state.currentBaseId!);
  const draft = loadDrafts().find(d => d.id === draftId);
  const text = draft?.text ?? baseText;

  state.baseText = baseText;
  state.currentText = text;

  if (editor) {
    suppressEditorChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text }
    });
    editor.scrollDOM.scrollTop = draft?.scrollTop ?? 0;
    suppressEditorChange = false;
  }

  payloadDescriptionInput.value = (() => {
    try {
      return (JSON.parse(text) as Payload).description || '';
    } catch {
      return '';
    }
  })();

  updateBarcodeData();
  renderPreview();
}

// ============================================
// Mobile Menu Toggle
// ============================================

menuToggle.addEventListener('click', () => {
  sidebarLeft.classList.toggle('open');
});

function updatePreviewToggle() {
  const isVisible = !sidebarRight.classList.contains('hidden');
  previewBtn.classList.toggle('active', isVisible);
}

// Preview Toggle (right sidebar)
previewToggle.addEventListener('click', () => {
  sidebarRight.classList.add('hidden');
  updatePreviewToggle();
});

previewBtn.addEventListener('click', () => {
  sidebarRight.classList.toggle('hidden');
  updatePreviewToggle();
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

// Cross-tab sync
broadcast?.addEventListener('message', () => refreshFromStorage());
window.addEventListener('storage', () => refreshFromStorage());

// ============================================
// Payload List
// ============================================

function renderPayloadList() {
  const userPayloads = loadPayloads();
  const drafts = loadDrafts();
  const draftMap = new Map(drafts.map(d => [d.id, d]));
  const newDrafts = drafts.filter(d => d.baseType === 'new');
  
  let html = '<div class="payload-section"><h4>Examples</h4>';
  for (const [id, payload] of Object.entries(presets)) {
    const active = state.currentBaseType === 'preset' && state.currentBaseId === id ? 'active' : '';
    const baseText = getBaseTextFromPayload(payload);
    const draft = draftMap.get(getDraftId('preset', id));
    const isDirty = !!draft && draft.text !== baseText;
    html += `<div class="payload-item preset ${active} ${isDirty ? 'dirty' : ''}" data-id="${id}" data-type="preset">
      <span class="payload-item-icon">${iconPackage}</span>
      <span class="payload-item-name">${payload.name}</span>
      <span class="dirty-dot ${isDirty ? '' : 'hidden'}"></span>
    </div>`;
  }
  html += '</div>';

  html += '<div class="payload-section">';
  html += '<div class="payload-section-header">';
  html += '<h4>My Payloads</h4>';
  html += `<button class="btn btn-sm btn-ghost payload-new-btn" id="newPayloadBtn">${iconPlus} New</button>`;
  html += '</div>';

  // Unsaved drafts
  for (const draft of newDrafts) {
    const name = getDraftName(draft.text);
    const active = state.currentBaseType === 'new' && state.currentBaseId === draft.id ? 'active' : '';
    html += `<div class="payload-item draft ${active} dirty" data-id="${draft.id}" data-type="draft">
      <span class="payload-item-name">${name}</span>
      <span class="dirty-dot"></span>
      <button class="payload-delete" data-id="${draft.id}" data-type="draft" title="Delete draft" aria-label="Delete draft">
        ${iconTrash}
      </button>
    </div>`;
  }

  // Saved payloads
  for (const stored of userPayloads) {
    const active = state.currentBaseType === 'user' && state.currentBaseId === stored.id ? 'active' : '';
    const baseText = getBaseTextFromPayload(stored.payload);
    const draft = draftMap.get(getDraftId('user', stored.id));
    const isDirty = !!draft && draft.text !== baseText;
    html += `<div class="payload-item ${active} ${isDirty ? 'dirty' : ''}" data-id="${stored.id}" data-type="user">
      <span class="payload-item-name">${stored.payload.name}</span>
      <span class="dirty-dot ${isDirty ? '' : 'hidden'}"></span>
      <button class="payload-duplicate" data-id="${stored.id}" title="Duplicate payload" aria-label="Duplicate payload">
        ${iconCopy}
      </button>
      <button class="payload-delete" data-id="${stored.id}" data-type="user" title="Delete payload" aria-label="Delete payload">
        ${iconTrash}
      </button>
    </div>`;
  }

  html += '</div>';
  
  payloadList.innerHTML = html;
  
  // Attach click handlers
  payloadList.querySelectorAll('.payload-item').forEach(item => {
    item.addEventListener('click', () => {
      const el = item as HTMLElement;
      selectPayload(el.dataset.id!, el.dataset.type as any);
      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        sidebarLeft.classList.remove('open');
      }
    });
  });

  // New button
  const newBtn = $('#newPayloadBtn');
  newBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    createNewDraft();
  });

  // Duplicate buttons
  payloadList.querySelectorAll<HTMLButtonElement>('.payload-duplicate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id!;
      if (!id) return;
      duplicatePayload(id);
    });
  });

  // Delete buttons
  payloadList.querySelectorAll<HTMLButtonElement>('.payload-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id!;
      const type = (btn as HTMLElement).dataset.type as any;
      if (!id) return;
      requestDelete(id, type);
    });
  });
  
  // Update export button state
  updateExportButtonState();
}

function updateExportButtonState() {
  const userPayloads = loadPayloads();
  const disabled = userPayloads.length === 0;
  exportBtn.disabled = disabled;
  exportAllBtn.disabled = disabled;
  exportBtn.title = disabled ? 'No user payloads to export' : 'Export payloads';
  exportAllBtn.title = disabled ? 'No user payloads to export' : 'Export all payloads (zip)';
}

function getDraftName(text: string): string {
  try {
    const payload = JSON.parse(text) as Payload;
    return payload.name || 'Untitled';
  } catch {
    return 'Untitled (invalid)';
  }
}

function createNewDraft() {
  const draftId = getDraftId('new');
  const payload: Payload = {
    name: 'New Payload',
    description: '',
    payload: [],
  };
  const text = getBaseTextFromPayload(payload);
  saveDraft({
    id: draftId,
    baseType: 'new',
    text,
    updatedAt: Date.now(),
  });
  emitStateChange();
  selectPayload(draftId, 'draft');
}

function duplicatePayload(id: string) {
  const stored = loadPayloads().find(p => p.id === id);
  if (!stored) return;
  const payload = { ...stored.payload, name: `${stored.payload.name} (copy)` };
  const newStored = createPayload(payload);
  selectPayload(newStored.id, 'user');
}

function requestDelete(id: string, type: 'user' | 'draft') {
  state.pendingDeleteId = id;
  const name = type === 'draft' ? getDraftName(loadDrafts().find(d => d.id === id)?.text || '') : (loadPayloads().find(p => p.id === id)?.payload.name || 'payload');
  deleteMessage.textContent = `Delete “${name}”? This cannot be undone.`;
  deleteModal.showModal();
}

function performDelete() {
  if (!state.pendingDeleteId) return;
  const id = state.pendingDeleteId;
  state.pendingDeleteId = null;

  // If it's a draft id (unsaved)
  const draft = loadDrafts().find(d => d.id === id);
  if (draft && draft.baseType === 'new') {
    deleteDraft(id);
    emitStateChange();
    if (state.currentBaseType === 'new' && state.currentBaseId === id) {
      const defaultPresetId = Object.keys(presets)[0];
      if (defaultPresetId) selectPayload(defaultPresetId, 'preset');
    }
    renderPayloadList();
    return;
  }

  const deleted = deletePayload(id);
  if (deleted) {
    deleteDraft(getDraftId('user', id));
    emitStateChange();
  }

  if (state.currentBaseType === 'user' && state.currentBaseId === id) {
    const defaultPresetId = Object.keys(presets)[0];
    if (defaultPresetId) {
      selectPayload(defaultPresetId, 'preset');
    } else {
      state.currentBaseId = null;
      state.currentBaseType = null;
      state.currentPayload = null;
      emptyState.classList.remove('hidden');
      editorView.classList.add('hidden');
      runnerView.classList.add('hidden');
    }
  }

  renderPayloadList();
  updateStatusBar('✓ Payload deleted', false);
}

function selectPayload(id: string, type?: 'preset' | 'user' | 'draft') {
  // Save scroll position for current draft before switching
  saveEditorScroll();

  let baseType: 'preset' | 'user' | 'new';
  let baseId: string | null = id;
  let basePayload: Payload | null = null;

  if (type === 'draft') {
    const draft = loadDrafts().find(d => d.id === id);
    if (!draft) return;
    if (draft.baseType === 'new') {
      baseType = 'new';
      baseId = draft.id;
      basePayload = null;
    } else if (draft.baseType === 'preset') {
      baseType = 'preset';
      baseId = draft.baseId || id;
      basePayload = presets[baseId!];
    } else {
      baseType = 'user';
      baseId = draft.baseId || id;
      basePayload = loadPayloads().find(p => p.id === baseId)?.payload || null;
    }
  } else if (type === 'user' || (!type && loadPayloads().find(p => p.id === id))) {
    baseType = 'user';
    basePayload = loadPayloads().find(p => p.id === id)?.payload || null;
  } else {
    baseType = 'preset';
    basePayload = presets[id];
  }

  if (baseType !== 'new' && !basePayload) return;

  state.currentBaseType = baseType;
  state.currentBaseId = baseId;
  state.currentPayloadId = baseId;

  const baseText = basePayload ? getBaseTextFromPayload(basePayload) : '';
  state.baseText = baseText;

    const draftId = baseType === 'new' ? baseId! : getDraftId(baseType, baseId!);
  const draft = loadDrafts().find(d => d.id === draftId);
  const text = draft?.text ?? baseText;

  state.currentText = text;

  // Update editor content
  if (editor) {
    suppressEditorChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text }
    });
    editor.scrollDOM.scrollTop = draft?.scrollTop ?? 0;
    suppressEditorChange = false;
  }

  // Parse current payload if valid
  try {
    state.currentPayload = JSON.parse(text) as Payload;
  } catch {
    state.currentPayload = basePayload;
  }

  // Show editor view
  showView('editor');

  // Update header
  payloadNameInput.value = state.currentPayload?.name || 'Untitled';
  payloadNameInput.readOnly = false;
  payloadDescriptionInput.value = state.currentPayload?.description || '';

  // Update barcode data and preview
  updateBarcodeData();
  renderPreview();

  const isDirty = baseType === 'new' || text !== baseText;
  setDirtyState(isDirty);

  // Re-render list to show selection
  renderPayloadList();
  
  updateStatusBar('Ready');
}
  
  // (duplicate block removed)

// ============================================
// View Management
// ============================================

function showView(view: 'editor' | 'runner') {
  state.view = view;
  
  emptyState.classList.add('hidden');
  editorView.classList.remove('hidden');

  if (view === 'editor') {
    runnerView.classList.add('hidden');
    editorContainer.classList.remove('hidden');
    editorStatusbar.classList.remove('hidden');
  } else {
    runnerView.classList.remove('hidden');
    editorContainer.classList.add('hidden');
    editorStatusbar.classList.add('hidden');
    runnerTitle.textContent = `Running: ${state.currentPayload?.name || 'Payload'}`;
    hideRunnerMessage();
    updateRunnerUI();
  }
}

// ============================================
// Editor
// ============================================

async function initEditor() {
  // Dynamically import CodeMirror
  const { EditorState, StateEffect, StateField, RangeSetBuilder } = await import('@codemirror/state');
  const { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration } = await import('@codemirror/view');
  const { json } = await import('@codemirror/lang-json');
  const { oneDark } = await import('@codemirror/theme-one-dark');
  const { defaultKeymap, history, historyKeymap } = await import('@codemirror/commands');
  const { lintGutter, setDiagnostics } = await import('@codemirror/lint');

  // Dirty line decorations
  setDirtyLinesEffect = StateEffect.define<number[]>();
  const dirtyLineField = StateField.define({
    create() {
      return Decoration.none;
    },
    update(deco, tr) {
      for (const e of tr.effects) {
        if (e.is(setDirtyLinesEffect)) {
          const builder = new RangeSetBuilder<any>();
          const lines = e.value as number[];
          for (const lineNo of lines) {
            if (lineNo <= 0) continue;
            const line = tr.state.doc.line(lineNo);
            builder.add(line.from, line.from, Decoration.line({ class: 'line-dirty' }));
          }
          return builder.finish();
        }
      }
      return deco.map(tr.changes);
    },
    provide: (f: any) => EditorView.decorations.from(f),
  });
  
  const startState = EditorState.create({
    doc: '{\n  "name": "New Payload",\n  "payload": []\n}',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      lintGutter(),
      dirtyLineField,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      json(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (suppressEditorChange) return;
          state.currentText = update.state.doc.toString();
          const isDirty = state.currentText !== state.baseText;
          setDirtyState(isDirty || state.currentBaseType === 'new');
          scheduleDraftSave();
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

  editor.scrollDOM.addEventListener('scroll', () => {
    scheduleDraftSave();
  });
  
  // Store setDiagnostics for later use
  (editor as any)._setDiagnostics = setDiagnostics;
}

function validateAndPreview() {
  try {
    const content = state.currentText || editor.state.doc.toString();
    const payload = JSON.parse(content) as Payload;
    
    // Basic validation
    if (!payload.name) throw new Error('Missing "name" field');
    if (!payload.payload || !Array.isArray(payload.payload)) {
      throw new Error('Missing or invalid "payload" array');
    }
    
    state.currentPayload = payload;
    if (document.activeElement !== payloadNameInput) {
      payloadNameInput.value = payload.name || '';
    }
    if (document.activeElement !== payloadDescriptionInput) {
      payloadDescriptionInput.value = payload.description || '';
    }
    updateStatusBar('✓ Valid JSON', false);
    
    // Clear any error diagnostics
    clearEditorErrors();
    
    updateBarcodeData();
    renderPreview();
  } catch (e) {
    const error = e as Error;
    updateStatusBar(`✗ ${error.message}`, true);
    
    // Try to highlight error location
    highlightErrorLocation(error);
  }
}

function clearEditorErrors() {
  if (editor && (editor as any)._setDiagnostics) {
    const setDiagnostics = (editor as any)._setDiagnostics;
    editor.dispatch({
      effects: setDiagnostics(editor.state, [])
    });
  }
}

function highlightErrorLocation(error: Error) {
  if (!editor || !(editor as any)._setDiagnostics) return;
  
  const setDiagnostics = (editor as any)._setDiagnostics;
  const message = error.message;
  
  // Try to parse error position from JSON.parse error messages
  // Format varies by browser:
  // Chrome: "Unexpected token } in JSON at position 42"
  // Firefox: "JSON.parse: expected ',' or '}' after property value in object at line 3 column 5"
  // Safari: "JSON Parse error: Expected '}'"
  
  let pos = 0;
  let line = 1;
  let col = 1;
  
  // Try Chrome/V8 format: "at position N"
  const posMatch = message.match(/at position (\d+)/i);
  if (posMatch) {
    pos = parseInt(posMatch[1], 10);
  }
  
  // Try Firefox format: "at line N column M"
  const lineColMatch = message.match(/at line (\d+) column (\d+)/i);
  if (lineColMatch) {
    line = parseInt(lineColMatch[1], 10);
    col = parseInt(lineColMatch[2], 10);
    // Convert line/col to position
    const docText = editor.state.doc.toString();
    const lines = docText.split('\n');
    pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1; // +1 for newline
    }
    pos += col - 1;
  }
  
  // Clamp position to document length
  const docLength = editor.state.doc.length;
  pos = Math.min(pos, docLength);
  
  // Create diagnostic
  const diagnostic = {
    from: pos,
    to: Math.min(pos + 1, docLength),
    severity: 'error' as const,
    message: error.message,
  };
  
  editor.dispatch({
    effects: setDiagnostics(editor.state, [diagnostic])
  });
  
  // Make status bar clickable to jump to error
  statusValidation.style.cursor = 'pointer';
  statusValidation.onclick = () => {
    editor.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
    editor.focus();
  };
}

function updateStatusBar(message: string, isError = false) {
  statusValidation.textContent = message;
  statusValidation.classList.toggle('error', isError);
  
  // Remove click handler if not error
  if (!isError) {
    statusValidation.style.cursor = '';
    statusValidation.onclick = null;
  }
}

function getActiveBarcodeData() {
  if (!state.barcodeData) return null;
  if (state.settings.barcodeVariant === 'combined' && state.barcodeData.combined) {
    return state.barcodeData.combined;
  }
  return state.barcodeData;
}

function setBarcodeCountsFromData(data: BarcodeData) {
  const setupCount = data.setupCount ?? 0;
  state.setupCount = setupCount;
  state.payloadCount = Math.max(0, data.barcodes.length - setupCount);
}

function syncBarcodeVariantOptions() {
  const hasCombined = !!state.barcodeData?.combined;
  const options = [previewModeSelect, runnerBarcodeModeSelect];
  options.forEach((select) => {
    const combinedOption = select.querySelector('option[value="combined"]') as HTMLOptionElement | null;
    if (combinedOption) {
      combinedOption.disabled = !hasCombined;
    }
  });
  if (!hasCombined && state.settings.barcodeVariant === 'combined') {
    state.settings = saveSettings({ barcodeVariant: 'individual' });
    previewModeSelect.value = 'individual';
    runnerBarcodeModeSelect.value = 'individual';
  }
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
    
    // Get full barcode data
    const data = engine.getBarcodeData(state.currentPayload);
    state.barcodeData = data;
    syncBarcodeVariantOptions();

    const active = getActiveBarcodeData();
    if (!active) {
      barcodeBadge.textContent = '0 barcodes';
      state.setupCount = 0;
      state.payloadCount = 0;
      return;
    }

    setBarcodeCountsFromData(active);
    const total = active.barcodes.length;
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
  const active = getActiveBarcodeData();
  if (!active || active.barcodes.length === 0) {
    previewList.innerHTML = '<div class="preview-empty">No barcodes to preview</div>';
    return;
  }
  
  setBarcodeCountsFromData(active);
  const { barcodes, symbology, BWIPPoptions } = active;
  const showComments = state.settings.barcodeVariant !== 'combined';
  
  // Build preview HTML
  let html = '';
  for (let i = 0; i < barcodes.length; i++) {
    const isSetup = i < state.setupCount;
    const type = isSetup ? 'setup' : 'payload';
    const typeIndex = isSetup ? i + 1 : i - state.setupCount + 1;
    const typeTotal = isSetup ? state.setupCount : state.payloadCount;
    const label = `${isSetup ? 'Setup' : 'Payload'} ${typeIndex}/${typeTotal}`;
    const comment = showComments ? (barcodes[i].comment ?? '') : '';
    
    html += `
      <div class="preview-item ${type}">
        <div class="preview-item-header">
          <span class="preview-item-label">${label}</span>
        </div>
        <canvas data-index="${i}"></canvas>
        ${comment ? `<div class="preview-item-comment">${comment}</div>` : ''}
      </div>
    `;
  }
  
  previewList.innerHTML = html;
  
  // Render each barcode to its canvas
  const canvases = previewList.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const index = parseInt((canvas as HTMLCanvasElement).dataset.index!, 10);
    const entry = barcodes[index];
    try {
      await renderToCanvas(canvas as HTMLCanvasElement, {
        symbology: entry.symbology ?? symbology,
        data: entry.code,
        scale: 2,
        ...BWIPPoptions,
        ...(entry.BWIPPoptions ?? {}),
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
  saveCurrentPayload();
});

discardBtn?.addEventListener('click', () => {
  discardChanges();
});

function parseCurrentPayload(): Payload | null {
  try {
    const payload = JSON.parse(state.currentText) as Payload;
    payload.name = payloadNameInput.value || payload.name;
    return payload;
  } catch (e) {
    updateStatusBar(`✗ ${(e as Error).message}`, true);
    return null;
  }
}

function saveCurrentPayload() {
  if (!state.currentBaseType) return;

  const payload = parseCurrentPayload();
  if (!payload) return;

  const oldDraftId = state.currentBaseType === 'new'
    ? state.currentBaseId
    : getDraftId(state.currentBaseType, state.currentBaseId!);

  if (state.currentBaseType === 'user') {
    updatePayload(state.currentBaseId!, payload);
  } else {
    const stored = createPayload(payload);
    state.currentBaseType = 'user';
    state.currentBaseId = stored.id;
    state.currentPayloadId = stored.id;
  }

  const newBaseText = getBaseTextFromPayload(payload);
  state.baseText = newBaseText;
  state.currentText = newBaseText;
  state.currentPayload = payload;

  if (editor) {
    suppressEditorChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: newBaseText }
    });
    suppressEditorChange = false;
  }

  if (oldDraftId) deleteDraft(oldDraftId);
  emitStateChange();

  setDirtyState(false);
  renderPayloadList();
  updateStatusBar('✓ Saved', false);
}

function discardChanges() {
  if (!state.currentBaseType) return;

  if (state.currentBaseType === 'new') {
    if (state.currentBaseId) deleteDraft(state.currentBaseId);
    emitStateChange();
    const defaultPresetId = Object.keys(presets)[0];
    if (defaultPresetId) selectPayload(defaultPresetId, 'preset');
    return;
  }

  const draftId = getDraftId(state.currentBaseType, state.currentBaseId!);
  deleteDraft(draftId);
  emitStateChange();

  state.currentText = state.baseText;
  if (editor) {
    suppressEditorChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: state.baseText }
    });
    suppressEditorChange = false;
  }

  setDirtyState(false);
  updateBarcodeData();
  renderPreview();
  updateStatusBar('✓ Changes discarded', false);
}

// Name input editing (sync into JSON when valid)
function syncFieldToJson(updates: Partial<Pick<Payload, 'name' | 'description'>>){
  if (!editor) return;
  try {
    const payload = JSON.parse(state.currentText) as Payload;
    if (typeof updates.name !== 'undefined') payload.name = updates.name;
    if (typeof updates.description !== 'undefined') payload.description = updates.description;
    const text = JSON.stringify(payload, null, 2);
    suppressEditorChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text }
    });
    suppressEditorChange = false;
    state.currentText = text;
    setDirtyState(state.currentText !== state.baseText || state.currentBaseType === 'new');
    scheduleDraftSave();
    validateAndPreview();
  } catch {
    // If JSON invalid, just mark dirty and keep input change
    state.editorDirty = true;
    setDirtyState(true);
  }
}

payloadNameInput.addEventListener('input', () => {
  syncFieldToJson({ name: payloadNameInput.value });
});

payloadDescriptionInput.addEventListener('input', () => {
  syncFieldToJson({ description: payloadDescriptionInput.value });
});

// ============================================
// Import/Export
// ============================================

$('#importBtn')?.addEventListener('click', () => {
  importTextarea.value = '';
  importFiles.value = '';
  hideImportError();
  importModal.showModal();
});

$('#importCancelBtn')?.addEventListener('click', () => {
  importModal.close();
});

importFiles.addEventListener('change', async () => {
  if (!importFiles.files || importFiles.files.length === 0) return;
  try {
    const texts = await Promise.all(Array.from(importFiles.files).map(readFileText));
    let imported: ReturnType<typeof importPayloads> = [];
    for (const text of texts) {
      imported = imported.concat(importPayloads(text));
    }
    importModal.close();
    renderPayloadList();
    if (imported.length > 0) {
      selectPayload(imported[0].id, 'user');
    }
  } catch (e) {
    showImportError(`Import failed: ${(e as Error).message}`);
  }
});

$('#importConfirmBtn')?.addEventListener('click', () => {
  try {
    if (!importTextarea.value.trim()) {
      showImportError('Paste JSON or choose a file to import.');
      return;
    }
    const imported = importPayloads(importTextarea.value);
    importModal.close();
    renderPayloadList();
    if (imported.length > 0) {
      selectPayload(imported[0].id, 'user');
    }
  } catch (e) {
    showImportError(`Import failed: ${(e as Error).message}`);
  }
});

exportBtn?.addEventListener('click', () => {
  const userPayloads = loadPayloads();
  if (userPayloads.length === 0) {
    // Button should be disabled, but just in case
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

exportAllBtn?.addEventListener('click', async () => {
  const userPayloads = loadPayloads();
  if (userPayloads.length === 0) return;

  const zip = new JSZip();
  for (const item of userPayloads) {
    const name = `${sanitizeFilename(item.payload.name || 'payload')}-${item.id}.json`;
    zip.file(name, JSON.stringify(item.payload, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'barcowned-payloads.zip';
  a.click();
  URL.revokeObjectURL(url);
});

// Delete modal actions
const closeDeleteModal = () => deleteModal.close();

deleteCloseBtn.addEventListener('click', closeDeleteModal);
deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteConfirmBtn.addEventListener('click', () => {
  performDelete();
  closeDeleteModal();
});

deleteModal.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    performDelete();
    closeDeleteModal();
  }
});

importModal.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    (document.querySelector('#importConfirmBtn') as HTMLButtonElement).click();
  }
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

  // Auto rate
  autoRateSelect.value = String(state.settings.autoRate ?? 0.4);
  autoRateSelect.addEventListener('change', () => {
    state.settings = saveSettings({ autoRate: parseFloat(autoRateSelect.value) });
  });
  
  // Start delay
  startDelaySelect.value = String(state.settings.startDelay ?? 0);
  startDelaySelect.addEventListener('change', () => {
    state.settings = saveSettings({ startDelay: parseInt(startDelaySelect.value) });
  });

  // Barcode mode (individual vs combined)
  const currentVariant = state.settings.barcodeVariant ?? 'individual';
  previewModeSelect.value = currentVariant;
  runnerBarcodeModeSelect.value = currentVariant;

  const applyVariant = (value: string) => {
    const variant = value === 'combined' ? 'combined' : 'individual';
    state.settings = saveSettings({ barcodeVariant: variant });
    previewModeSelect.value = variant;
    runnerBarcodeModeSelect.value = variant;
    syncBarcodeVariantOptions();
    state.currentBarcodeIndex = 0;
    const active = getActiveBarcodeData();
    if (active) {
      setBarcodeCountsFromData(active);
      const total = active.barcodes.length;
      barcodeBadge.textContent = `${total} barcode${total !== 1 ? 's' : ''}`;
    }
    renderPreview();
    renderCurrentBarcode();
    updateRunnerUI();
  };

  previewModeSelect.addEventListener('change', () => {
    applyVariant(previewModeSelect.value);
  });

  runnerBarcodeModeSelect.addEventListener('change', () => {
    applyVariant(runnerBarcodeModeSelect.value);
  });

  // Size controls
  sizeMinusBtn.addEventListener('click', () => adjustBarcodeScale(-0.5));
  sizePlusBtn.addEventListener('click', () => adjustBarcodeScale(0.5));
  sizeFullscreenBtn.addEventListener('click', () => barcodeContainer.requestFullscreen?.());

  // Play/pause
  playPauseBtn.addEventListener('click', () => {
    if (state.isRunning) {
      pausePlayback();
    } else {
      startPlayback();
    }
  });

  updateRunnerUI();
}

function updateRunnerUI() {
  // Update progress
  const active = getActiveBarcodeData();
  if (active) {
    const total = active.barcodes.length;
    progressText.textContent = `0 / ${total}`;
    progressFill.style.width = '0%';
  }
  timeText.textContent = 'Paused';
  timeProgressFill.style.width = '0%';

  updatePlayPauseButton();
  updateSizeLabel();
}

$('#runBtn')?.addEventListener('click', () => {
  const active = getActiveBarcodeData();
  if (!active || active.barcodes.length === 0) {
    showRunnerMessage('No barcodes to display. Select a payload first.', true);
    showView('runner');
    return;
  }
  showView('runner');
  state.currentBarcodeIndex = 0;
  renderCurrentBarcode();
  updateRunnerUI();
});

$('#backToEditorBtn')?.addEventListener('click', () => {
  pausePlayback();
  showView('editor');
});

prevBtn.addEventListener('click', () => {
  if (state.currentBarcodeIndex > 0) {
    state.currentBarcodeIndex--;
    renderCurrentBarcode();
  }
});

nextBtn.addEventListener('click', () => {
  const active = getActiveBarcodeData();
  if (active && state.currentBarcodeIndex < active.barcodes.length - 1) {
    state.currentBarcodeIndex++;
    renderCurrentBarcode();
  }
});

barcodeContainer.addEventListener('click', () => {
  const active = getActiveBarcodeData();
  if (active && state.currentBarcodeIndex < active.barcodes.length - 1) {
    state.currentBarcodeIndex++;
    renderCurrentBarcode();
  }
});

document.addEventListener('keydown', (e) => {
  if (state.view !== 'runner') return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (state.currentBarcodeIndex > 0) {
      state.currentBarcodeIndex--;
      renderCurrentBarcode();
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const active = getActiveBarcodeData();
    if (active && state.currentBarcodeIndex < active.barcodes.length - 1) {
      state.currentBarcodeIndex++;
      renderCurrentBarcode();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.isRunning) pausePlayback(); else startPlayback();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    pausePlayback();
    showView('editor');
  }
});

function startPlayback() {
  const active = getActiveBarcodeData();
  if (!active || active.barcodes.length === 0) {
    showRunnerMessage('No barcodes to display.', true);
    return;
  }
  hideRunnerMessage();
  state.isRunning = true;
  updatePlayPauseButton();

  const delayMs = (state.settings.startDelay || 0) * 1000;
  if (delayMs > 0) {
    timeText.textContent = `Starting in ${(delayMs / 1000).toFixed(1)}s`;
    if (state.playbackTimeout) clearTimeout(state.playbackTimeout);
    state.playbackTimeout = window.setTimeout(() => {
      renderCurrentBarcode();
      scheduleNextAdvance();
    }, delayMs);
  } else {
    scheduleNextAdvance();
  }
}

function pausePlayback() {
  state.isRunning = false;
  if (state.playbackTimeout) {
    clearTimeout(state.playbackTimeout);
    state.playbackTimeout = null;
  }
  if (state.timeRaf) {
    cancelAnimationFrame(state.timeRaf);
    state.timeRaf = null;
  }
  state.nextAdvanceAt = null;
  state.remainingMs = null;
  timeText.textContent = 'Paused';
  timeProgressFill.style.width = '0%';
  updatePlayPauseButton();
}

function scheduleNextAdvance() {
  if (!state.isRunning) return;
  const intervalMs = 1000 / state.settings.autoRate;
  state.nextAdvanceAt = Date.now() + intervalMs;
  state.remainingMs = intervalMs;

  state.playbackTimeout = window.setTimeout(() => {
    const active = getActiveBarcodeData();
    if (!state.isRunning || !active) return;
    if (state.currentBarcodeIndex < active.barcodes.length - 1) {
      state.currentBarcodeIndex++;
      renderCurrentBarcode();
      scheduleNextAdvance();
    } else {
      pausePlayback();
    }
  }, intervalMs);

  startTimeProgress();
}

function startTimeProgress() {
  const intervalMs = 1000 / state.settings.autoRate;
  const tick = () => {
    if (!state.isRunning || !state.nextAdvanceAt) return;
    const remaining = Math.max(0, state.nextAdvanceAt - Date.now());
    state.remainingMs = remaining;
    timeText.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : '0.0s';
    const pct = Math.min(100, Math.max(0, (1 - remaining / intervalMs) * 100));
    timeProgressFill.style.width = `${pct}%`;
    state.timeRaf = requestAnimationFrame(tick);
  };
  state.timeRaf = requestAnimationFrame(tick);
}

function updatePlayPauseButton() {
  if (state.isRunning) {
    playPauseBtn.innerHTML = `${iconPause} Pause`;
  } else {
    playPauseBtn.innerHTML = `${iconPlay} Play`;
  }
}

function adjustBarcodeScale(delta: number) {
  const current = state.settings.barcodeScale ?? 4;
  const next = Math.max(0.1, current + delta);
  state.settings = saveSettings({ barcodeScale: next });
  updateSizeLabel();
  renderCurrentBarcode();
}

function updateSizeLabel() {
  const current = state.settings.barcodeScale ?? 4;
  const pct = Math.round((current / 4) * 100);
  sizeValue.textContent = `${pct}%`;
}

function updateShareSizeLabel() {
  const current = state.settings.shareQrScale ?? 3;
  const pct = Math.round((current / 3) * 100);
  shareSizeValue.textContent = `${pct}%`;
}

async function adjustShareScale(delta: number) {
  const current = state.settings.shareQrScale ?? 3;
  const next = Math.max(0.5, current + delta);
  state.settings = saveSettings({ shareQrScale: next });
  updateShareSizeLabel();
  if (shareUrl.value) {
    await renderShareQrCode(shareQrCanvas, shareUrl.value, next);
  }
}

function renderCurrentBarcode() {
  const data = getActiveBarcodeData();
  if (!data) return;

  setBarcodeCountsFromData(data);
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

  const entry = data.barcodes[index];
  const showComments = state.settings.barcodeVariant !== 'combined';
  barcodeComment.textContent = showComments ? (entry.comment ?? '') : '';

  // Render barcode
  renderToCanvas(barcodeCanvas, {
    symbology: entry.symbology ?? data.symbology,
    data: entry.code,
    scale: state.settings.barcodeScale ?? 4,
    ...data.BWIPPoptions,
    ...(entry.BWIPPoptions ?? {}),
  }).catch(e => {
    console.error('Render error:', e);
  });

  // Update nav buttons
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === total - 1;

  if (!state.isRunning) {
    timeText.textContent = 'Paused';
    timeProgressFill.style.width = '0%';
  }
}

// (fullscreen now handled by button; click advances)

// ============================================
// Share
// ============================================

$('#shareBtn')?.addEventListener('click', async () => {
  if (!state.currentPayload) {
    // This shouldn't happen since share button is in editor view
    return;
  }
  
  const url = generateShareUrl(state.currentPayload, state.settings);
  shareUrl.value = url;
  
  // Render QR code
  try {
    await renderShareQrCode(shareQrCanvas, url, state.settings.shareQrScale ?? 3);
    updateShareSizeLabel();
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
    const copyBtn = $('#copyUrlBtn') as HTMLButtonElement;
    const originalContent = copyBtn.innerHTML;
    copyBtn.innerHTML = `${iconCopy} Copied!`;
    setTimeout(() => {
      copyBtn.innerHTML = originalContent;
    }, 1500);
  }
});

shareSizeMinusBtn.addEventListener('click', async () => {
  adjustShareScale(-0.5);
});

shareSizePlusBtn.addEventListener('click', async () => {
  adjustShareScale(0.5);
});

// Close modal on backdrop click
shareModal.addEventListener('click', (e) => {
  if (e.target === shareModal) {
    shareModal.close();
  }
});

shareModal.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    (document.querySelector('#copyUrlBtn') as HTMLButtonElement).click();
  }
});

// ============================================
// Initialize Icons in DOM
// ============================================

function initIcons() {
  // Nav
  const menuToggleEl = $('#menuToggle');
  if (menuToggleEl) menuToggleEl.innerHTML = iconMenu;
  
  const navLogo = $('.nav-logo');
  if (navLogo) navLogo.innerHTML = iconScanBarcode;
  
  // Toolbar
  const saveIcon = $('#saveBtn .toolbar-icon');
  if (saveIcon) saveIcon.innerHTML = iconSave;

  const discardIcon = $('#discardBtn .toolbar-icon');
  if (discardIcon) discardIcon.innerHTML = iconUndo;

  const previewIcon = $('#previewBtn .toolbar-icon');
  if (previewIcon) previewIcon.innerHTML = iconPanelRight;
  
  const runIcon = $('#runBtn .toolbar-icon');
  if (runIcon) runIcon.innerHTML = iconPlay;
  
  const shareIcon = $('#shareBtn .toolbar-icon');
  if (shareIcon) shareIcon.innerHTML = iconShare;
  
  // Sidebar footer
  const newBtn = $('#newPayloadBtn');
  if (newBtn) newBtn.innerHTML = `${iconPlus} New`;
  
  const importBtn = $('#importBtn');
  if (importBtn) importBtn.innerHTML = `${iconImport} Import`;
  
  const exportBtnEl = $('#exportBtn');
  if (exportBtnEl) exportBtnEl.innerHTML = `${iconExport} Export`;

  const exportAllBtnEl = $('#exportAllBtn');
  if (exportAllBtnEl) exportAllBtnEl.innerHTML = `${iconExport} Export All`;
  
  // Runner
  const backBtn = $('#backToEditorBtn');
  if (backBtn) backBtn.innerHTML = `${iconArrowLeft} Back to Editor`;
  
  const prevBtnEl = $('#prevBtn');
  if (prevBtnEl) prevBtnEl.innerHTML = `${iconChevronLeft} Prev`;
  
  const nextBtnEl = $('#nextBtn');
  if (nextBtnEl) nextBtnEl.innerHTML = `Next ${iconChevronRight}`;

  const playPauseBtnEl = $('#playPauseBtn');
  if (playPauseBtnEl) playPauseBtnEl.innerHTML = `${iconPlay} Play`;

  const sizeMinus = $('#sizeMinusBtn');
  if (sizeMinus) sizeMinus.innerHTML = `${iconMinus}`;

  const sizePlus = $('#sizePlusBtn');
  if (sizePlus) sizePlus.innerHTML = `${iconPlus}`;

  const sizeFullscreen = $('#sizeFullscreenBtn');
  if (sizeFullscreen) sizeFullscreen.innerHTML = `${iconMaximize} Fullscreen`;

  const shareSizeMinus = $('#shareSizeMinusBtn');
  if (shareSizeMinus) shareSizeMinus.innerHTML = `${iconMinus}`;

  const shareSizePlus = $('#shareSizePlusBtn');
  if (shareSizePlus) shareSizePlus.innerHTML = `${iconPlus}`;
  
  // Modals
  const shareCloseBtn = $('#shareCloseBtn');
  if (shareCloseBtn) shareCloseBtn.innerHTML = iconX;

  const deleteClose = $('#deleteCloseBtn');
  if (deleteClose) deleteClose.innerHTML = iconX;
  
  const copyUrlBtn = $('#copyUrlBtn');
  if (copyUrlBtn) copyUrlBtn.innerHTML = `${iconCopy} Copy`;

  const importFilesBtn = $('#importFilesBtn');
  if (importFilesBtn) importFilesBtn.innerHTML = `${iconImport} Choose files`;
  
  // Preview toggle
  const previewToggle = $('#previewToggle');
  if (previewToggle) previewToggle.innerHTML = iconX;
}

// ============================================
// Initialization
// ============================================

async function init() {
  // Initialize icons first
  initIcons();
  
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
    selectPayload(stored.id, 'user');
    return;
  }
  
  // Initialize components
  await initEditor();
  initRunner();
  renderPayloadList();
  updatePreviewToggle();
  updateShareSizeLabel();
  
  // Default: select "Hello World" preset
  const defaultPresetId = Object.keys(presets)[0];
  if (defaultPresetId) {
    selectPayload(defaultPresetId, 'preset');
  }
}

init().catch(console.error);
