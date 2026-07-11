import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, FolderOpen, Save, Languages, Type, Info, X, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

const APP_VERSION = __WEBSITE_VERSION__;

// Single-token extension. Some browsers/OS file pickers only recognize the
// *last* dot as "the extension" — when the accepted extension has two dots
// (".hv.braille"), the native Save dialog can decide the typed name is
// missing its extension and append the whole thing again, producing
// "name.hv.braille.hv.braille". Using one dot avoids that ambiguity entirely.
const FILE_EXTENSION = '.houvec';
// Old file extension kept only so previously-saved files can still be opened.
const LEGACY_EXTENSION = '.houvec';

const BRAILLE_MAP = {
  A: '1234', B: '1246', C: '1256', D: '1346', E: '2346', F: '12345', G: '12456', H: '12546', I: '13456', J: '23456',
  K: '12346', L: '12435', M: '12534', N: '13425', O: '23415', P: '12356', Q: '12456', R: '13546', S: '14526', T: '23546',
  U: '12345', V: '13425', W: '24536', X: '12546', Y: '23415', Z: '13456',
  a: '24', b: '245', c: '25', d: '256', e: '26', f: '124', g: '1245', h: '125', i: '145', j: '1456', k: '14', l: '134',
  m: '1345', n: '135', o: '1356', p: '123', q: '1235', r: '1236', s: '234', t: '2345', u: '246', v: '2456', w: '2356',
  x: '1346', y: '12346', z: '12356',
  '1': '15', '2': '156', '3': '35', '4': '356', '5': '36', '6': '16', '7': '126', '8': '1256', '9': '256', '0': '135',
  ' ': ' ', '.': '146', ',': '246', '?': '236', '!': '346', "'": '56', '-': '345',
  ':': '1456', ';': '2456', '"': '1256', '(': '12345', ')': '13456', '/': '235', '\n': '\n',
};

function dotsToBinary(dots) {
  if (dots === ' ') return '000000';
  if (dots === '\n') return '\n';

  const bits = ['0', '0', '0', '0', '0', '0'];

  for (const d of dots) {
    if (d >= '1' && d <= '6') {
      bits[Number(d) - 1] = '1';
    }
  }

  return bits.join('');
}

function binaryToDots(binary) {
  if (binary === '000000') return ' ';
  if (binary === '\n') return '\n';

  let dots = '';

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      dots += String(i + 1);
    }
  }

  return dots;
}

const REVERSE_MAP = {};

Object.entries(BRAILLE_MAP).forEach(([plain, braille]) => {
  if (
    plain >= 'a' &&
    plain <= 'z'
  ) {
    REVERSE_MAP[braille] = plain;
  }
});

Object.entries(BRAILLE_MAP).forEach(([plain, braille]) => {
  if (!(braille in REVERSE_MAP)) {
    REVERSE_MAP[braille] = plain;
  }
});

function textToBraille(text) {
  return text
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase();
      return BRAILLE_MAP[lower] !== undefined ? BRAILLE_MAP[lower] : ch;
    })
    .join('');
}

function brailleToText(braille) {
  return braille
    .split('')
    .map((ch) => (REVERSE_MAP[ch] !== undefined ? REVERSE_MAP[ch] : ch))
    .join('');
}

// Strips ANY trailing occurrence(s) of either the current or legacy
// extension, repeatedly, so a name is never left with a doubled suffix no
// matter how it arrived (typed by hand, pre-filled from a previous file,
// or round-tripped through an OS save dialog).
function stripKnownExtensions(name) {
  let base = (name || '').trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (base.toLowerCase().endsWith(FILE_EXTENSION)) {
      base = base.slice(0, base.length - FILE_EXTENSION.length);
      changed = true;
    } else if (base.toLowerCase().endsWith(LEGACY_EXTENSION)) {
      base = base.slice(0, base.length - LEGACY_EXTENSION.length);
      changed = true;
    }
  }
  return base;
}

function sanitizeFileName(name) {
  const cleaned = stripKnownExtensions(name).replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned.length ? cleaned : 'untitled';
}

function hasKnownExtension(fileName) {
  const lower = (fileName || '').toLowerCase();
  return lower.endsWith(FILE_EXTENSION) || lower.endsWith(LEGACY_EXTENSION);
}

const COLORS = {
  ink: '#14161f',
  inkPanel: '#1b1e29',
  inkLine: '#2b2f3d',
  paper: '#f5efe1',
  paperSoft: '#ece3cf',
  brass: '#c98a3e',
  brassBright: '#e3ab63',
  rose: '#c06a4d',
  textOnInk: '#e7e2d3',
  mutedOnInk: '#8d90a1',
  textOnPaper: '#241f16',
  mutedOnPaper: '#7c7360',
  danger: '#c96a5c',
  success: '#6fa87e',
};

function DotLogo({ active }) {
  const positions = [
    [0, 0], [1, 0],
    [0, 1], [1, 1],
    [0, 2], [1, 2],
  ];
  return (
    <svg width="26" height="38" viewBox="0 0 26 38" aria-hidden="true">
      {positions.map(([col, row], i) => (
        <circle
          key={i}
          cx={7 + col * 12}
          cy={6 + row * 12}
          r="4.4"
          fill={COLORS.brassBright}
          style={{
            animation: active ? `dotPulse 2.4s ease-in-out ${i * 0.18}s infinite` : 'none',
            transformOrigin: `${7 + col * 12}px ${6 + row * 12}px`,
          }}
        />
      ))}
    </svg>
  );
}

export default function BrailleEditor() {
  const [mode, setMode] = useState('create');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState(null);
  const [fileHandle, setFileHandle] = useState(null);
  const [openedFile, setOpenedFile] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [toast, setToast] = useState(null);

  const leftRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const supportsFS = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

  const showToast = useCallback((type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const handleCreateModeChange = (e) => {
    const newDisplayed = e.target.value;
    const oldDisplayed = textToBraille(rawText);
    let start = 0;
    const maxStart = Math.min(oldDisplayed.length, newDisplayed.length);
    while (start < maxStart && oldDisplayed[start] === newDisplayed[start]) start++;
    let oldEnd = oldDisplayed.length;
    let newEnd = newDisplayed.length;
    while (oldEnd > start && newEnd > start && oldDisplayed[oldEnd - 1] === newDisplayed[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const removed = oldEnd - start;
    const inserted = newDisplayed.slice(start, newEnd);
    const newRaw = rawText.slice(0, start) + inserted + rawText.slice(start + removed);
    cursorPosRef.current = e.target.selectionStart;
    setRawText(newRaw);
    setDirty(true);
  };

  const buildFileContent = () => {
    const braille = rawText
      .split('')
      .map((ch) => {
        const dots = BRAILLE_MAP[ch.toLowerCase()] ?? ch;
        return dotsToBinary(dots);
      })
      .join(' ');

    return `${braille}\n\n---\nVersion: ${APP_VERSION}\n`;
  };

  function fallbackDownload(name, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFileHandle(null);
    setFileName(name);
    setDirty(false);
    showToast('info', `ឯកសារ "${name}" ត្រូវបានទាញយក — ប្រសិនបើត្រូវការ សូមផ្លាស់ទីវាទៅ Desktop ដោយដៃ`);
  }

  async function performCreateFile(rawName) {
    const finalName = sanitizeFileName(rawName) + FILE_EXTENSION;
    const content = buildFileContent();
    if (supportsFS) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: finalName,
          types: [{ description: 'HV Braille File', accept: { 'text/plain': [FILE_EXTENSION] } }],
        });
        // Defensive: normalize whatever name the OS/browser handed back, in
        // case a picker still appends its own extension on top of ours.
        const safeName = sanitizeFileName(handle.name) + FILE_EXTENSION;
        setFileHandle(handle);
        setFileName(safeName);
        setDirty(false);
        showToast('success', `បានបង្កើតឯកសារ "${safeName}" ជោគជ័យ`);
      } catch (err) {
        if (err && err.name !== 'AbortError') fallbackDownload(finalName, content);
      }
    } else {
      fallbackDownload(finalName, content);
    }
  }

  async function handleSave() {
    if (!fileName) {
      showToast('error', 'សូមបង្កើត ឬបើកឯកសារជាមុនសិន');
      return;
    }
    const content = buildFileContent();
    if (fileHandle && fileHandle.createWritable) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        setDirty(false);
        showToast('success', `បានរក្សាទុក "${fileName}" ជោគជ័យ`);
      } catch (err) {
        showToast('error', 'មិនអាចរក្សាទុកបានទេ');
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();

      URL.revokeObjectURL(url);

      setDirty(false);
      showToast('success', `បានទាញយក "${fileName}" ថ្មី`);
    }
  }

  async function loadFile(file, handle) {
    try {
      const text = await file.text();
      const [brailleContent] = text.split('\n\n---\n');
      const binaryText = (brailleContent || '').replace(/\n$/, '');

      const restoredRaw = binaryText
        .split(' ')
        .map((binary) => {
          const dots = binaryToDots(binary);
          return REVERSE_MAP[dots] ?? dots;
        })
        .join('');

      const displayName = sanitizeFileName(file.name) + FILE_EXTENSION;

      setRawText(restoredRaw);
      setFileHandle(handle);
      setOpenedFile(file);
      setFileName(displayName);
      setMode('create');
      setDirty(false);

      showToast('success', `បានបើកឯកសារ "${displayName}"`);
    } catch (err) {
      showToast('error', 'មិនអាចអានឯកសារនេះបានទេ');
    }
  }

  async function handleOpenFile() {
    if (supportsFS) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'HV Braille File',
            accept: { 'text/plain': [FILE_EXTENSION, LEGACY_EXTENSION] },
          }],
          excludeAcceptAllOption: true,
          multiple: false,
        });
        const file = await handle.getFile();
        await loadFile(file, handle);
      } catch (err) {
        /* user cancelled */
      }
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleFileInputChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    await loadFile(file, null);
  }

  const rightDisplay = textToBraille(rawText);
  const charCount = rawText.length;
  const showFileButtons = mode === 'create';

  return (
    <div style={styles.appShell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes dotPulse {
          0%, 60%, 100% { opacity: 0.45; transform: scale(1); }
          20% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
        .hv-header { animation: slideDown 0.5s ease-out; }
        .hv-panel { animation: fadeUp 0.6s ease-out; }
        .hv-btn { transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease, border-color 0.15s ease; }
        .hv-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .hv-btn:active:not(:disabled) { transform: translateY(0px) scale(0.97); }
        .hv-select { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .hv-textarea { transition: box-shadow 0.15s ease; }
        .hv-textarea:focus { outline: none; }
        ::selection { background: ${COLORS.brass}; color: ${COLORS.ink}; }
        @media (max-width: 820px) {
          .hv-body { grid-template-columns: 1fr !important; grid-template-rows: 1fr 1fr; }
          .hv-toolbar { flex-wrap: wrap; }
        }
      `}</style>

      <header className="hv-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <DotLogo active />
          <div>
            <h1 style={styles.title}>Houv_Encrypt</h1>
            <p style={styles.subtitle}>កម្មវិធីសរសេរ &amp; បំប្លែងអក្សរទៅជា Code Binary ជាបន្តបន្ទាប់</p>
          </div>
        </div>

        <div className="hv-toolbar" style={styles.toolbar}>
          <div style={styles.selectWrap}>
            <label style={styles.selectLabel}>របៀប</label>
            <select
              className="hv-select"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={styles.select}
            >
              <option value="create">Create file</option>
              <option value="translate">Translate</option>
            </select>
          </div>

          {showFileButtons && (
            <>
              <button
                className="hv-btn"
                style={styles.btnPrimary}
                onClick={() => {
                  setNameInput(fileName ? sanitizeFileName(fileName) : '');
                  setShowNameModal(true);
                }}
              >
                <FileText size={16} /> Create file
              </button>
              <button className="hv-btn" style={styles.btnGhost} onClick={handleOpenFile}>
                <FolderOpen size={16} /> Open file
              </button>
              <button className="hv-btn" style={styles.btnGhost} onClick={handleSave}>
                <Save size={16} /> Save
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={`${FILE_EXTENSION},${LEGACY_EXTENSION}`}
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
            </>
          )}

          <button
            className="hv-btn"
            style={styles.btnIcon}
            onClick={() => setShowInfo((v) => !v)}
            aria-label="ព័ត៌មានអំពីតារាង Houv_EC"
          >
            <Info size={16} />
          </button>

          <div style={styles.versionBadge}>v{APP_VERSION}</div>
        </div>
      </header>

      {showInfo && (
        <div style={styles.infoPanel}>
          <div style={styles.infoPanelInner}>
            <p style={styles.infoText}>
              ការបំប្លែងនេះប្រើតារាង Houv_EC កម្រិត១ (Grade&nbsp;1) ដ៏សាមញ្ញ៖ អក្សរធំ-តូចប្រើចំណុចដូចគ្នា
              ហើយលេខ ០-៩ ប្រើចំណុចដូចអក្សរ a-j ដើម្បីរក្សាទំហំអក្សរឲ្យស្មើគ្នារវាងអក្សរធម្មតានិង Houv_EC។
            </p>
            <button style={styles.infoClose} onClick={() => setShowInfo(false)} aria-label="បិទ">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <main className="hv-body" style={styles.body}>
        <section className="hv-panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelHeaderIcon}>
              {mode === 'create' ? <Sparkles size={14} /> : <Type size={14} />}
            </span>
            <span style={styles.panelHeaderText}>
              {mode === 'create' ? 'អក្សរធម្មតា' : 'អក្សរធម្មតា'}
            </span>
          </div>
          {mode === 'create' ? (
            <textarea
              ref={leftRef}
              className="hv-textarea"
              style={styles.textareaPlain}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setDirty(true);
              }}
              placeholder="វាយអក្សរធម្មតានៅទីនេះ..."
              spellCheck={false}
            />
          ) : (
            <textarea
              className="hv-textarea"
              style={styles.textareaPlain}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setDirty(true);
              }}
              placeholder="វាយអក្សរធម្មតានៅទីនេះ..."
              spellCheck={false}
            />
          )}
        </section>

        <div style={styles.divider} aria-hidden="true">
          <span style={styles.dividerDot} />
          <span style={styles.dividerDot} />
          <span style={styles.dividerDot} />
        </div>

        <section className="hv-panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelHeaderIcon}>
              {mode === 'create' ? <Type size={14} /> : <Sparkles size={14} />}
            </span>
            <span style={styles.panelHeaderText}>
              {mode === 'create' ? 'Houv_EC Code' : 'Houv_EC Code'}
            </span>
          </div>
          <div style={styles.outputBraille}>
            {rightDisplay || <span style={{ opacity: 0.4 }}>លទ្ធផលបង្ហាញនៅទីនេះ...</span>}
          </div>
        </section>
      </main>

      <footer style={styles.statusBar}>
        <span>{fileName ? `${fileName}${dirty ? ' •' : ''}` : 'ឯកសារថ្មី (មិនទាន់រក្សាទុក)'}</span>
        <span style={styles.statusDivider}>·</span>
        <span>{mode === 'create' ? 'Create file' : 'Translate'}</span>
        <span style={styles.statusDivider}>·</span>
        <span>{charCount} តួអក្សរ</span>
        <span style={{ marginLeft: 'auto' }}>Houv_EC v{APP_VERSION}</span>
      </footer>

      {showNameModal && (
        <div style={styles.modalOverlay} onClick={() => setShowNameModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>រក្សាទុកជាឯកសារថ្មី</h2>
            <p style={styles.modalSubtitle}>ដាក់ឈ្មោះឯកសារ — ប្រព័ន្ធនឹងបន្ថែម <code>{FILE_EXTENSION}</code> ដោយស្វ័យប្រវត្តិ</p>
            <input
              autoFocus
              style={styles.modalInput}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="untitled"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowNameModal(false);
                  performCreateFile(nameInput);
                }
              }}
            />
            <div style={styles.modalHint}>{sanitizeFileName(nameInput)}{FILE_EXTENSION}</div>
            <div style={styles.modalActions}>
              <button className="hv-btn" style={styles.btnGhost} onClick={() => setShowNameModal(false)}>
                បោះបង់
              </button>
              <button
                className="hv-btn"
                style={styles.btnPrimary}
                onClick={() => {
                  setShowNameModal(false);
                  performCreateFile(nameInput);
                }}
              >
                <FileText size={16} /> បង្កើតឯកសារ
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            ...styles.toast,
            borderColor: toast.type === 'error' ? COLORS.danger : toast.type === 'success' ? COLORS.success : COLORS.brass,
          }}
        >
          {toast.type === 'error' ? (
            <AlertTriangle size={16} color={COLORS.danger} />
          ) : (
            <CheckCircle2 size={16} color={toast.type === 'success' ? COLORS.success : COLORS.brass} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

const fontVoice = "'khmer', serif";
const fontSans = "'khmer', sans-serif";
const fontMono = "'JetBrains Mono', monospace";

const styles = {
  appShell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: COLORS.ink,
    fontFamily: fontSans,
    color: COLORS.textOnInk,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 24px',
    borderBottom: `1px solid ${COLORS.inkLine}`,
    background: COLORS.inkPanel,
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontFamily: fontVoice, fontSize: 20, fontWeight: 600, margin: 0, color: COLORS.paper, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, margin: '2px 0 0', color: COLORS.mutedOnInk },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10 },
  selectWrap: { display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 },
  selectLabel: { fontSize: 11, color: COLORS.mutedOnInk },
  select: {
    background: COLORS.ink,
    color: COLORS.textOnInk,
    border: `1px solid ${COLORS.inkLine}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: fontSans,
    cursor: 'pointer',
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: COLORS.brass,
    color: COLORS.ink,
    border: `1px solid ${COLORS.brass}`,
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: fontSans,
  },
  btnGhost: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    color: COLORS.textOnInk,
    border: `1px solid ${COLORS.inkLine}`,
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: fontSans,
  },
  btnIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    background: 'transparent',
    color: COLORS.mutedOnInk,
    border: `1px solid ${COLORS.inkLine}`,
    borderRadius: 8,
    cursor: 'pointer',
  },
  versionBadge: {
    fontFamily: fontMono,
    fontSize: 11,
    color: COLORS.brassBright,
    background: 'rgba(201,138,62,0.12)',
    border: `1px solid rgba(201,138,62,0.3)`,
    borderRadius: 6,
    padding: '4px 8px',
  },
  infoPanel: { padding: '0 24px', background: COLORS.inkPanel, borderBottom: `1px solid ${COLORS.inkLine}` },
  infoPanelInner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 0',
    maxWidth: 900,
  },
  infoText: { fontSize: 12.5, color: COLORS.mutedOnInk, margin: 0, lineHeight: 1.6, flex: 1 },
  infoClose: {
    background: 'transparent',
    border: 'none',
    color: COLORS.mutedOnInk,
    cursor: 'pointer',
    padding: 2,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 0,
    padding: 20,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: COLORS.paper,
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
    minHeight: 420,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: COLORS.paperSoft,
    borderBottom: `1px solid rgba(36,31,22,0.1)`,
    color: COLORS.mutedOnPaper,
  },
  panelHeaderIcon: { display: 'flex', color: COLORS.brass },
  panelHeaderText: { fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' },
  textareaBraille: {
    flex: 1,
    border: 'none',
    resize: 'none',
    padding: '20px 22px',
    background: 'transparent',
    color: COLORS.textOnPaper,
    fontFamily: fontMono,
    fontSize: 22,
    lineHeight: 1.9,
    letterSpacing: 2,
  },
  textareaPlain: {
    flex: 1,
    border: 'none',
    resize: 'none',
    padding: '20px 22px',
    background: 'transparent',
    color: COLORS.textOnPaper,
    fontFamily: fontVoice,
    fontSize: 17,
    lineHeight: 1.8,
  },
  outputPlain: {
    flex: 1,
    padding: '20px 22px',
    color: COLORS.textOnPaper,
    fontFamily: fontVoice,
    fontSize: 17,
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
  },
  outputBraille: {
    flex: 1,
    padding: '20px 22px',
    color: COLORS.textOnPaper,
    fontFamily: fontMono,
    fontSize: 22,
    lineHeight: 1.9,
    letterSpacing: 2,
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
  },
  divider: {
    width: 32,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dividerDot: { width: 5, height: 5, borderRadius: '50%', background: COLORS.inkLine },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 24px',
    background: COLORS.inkPanel,
    borderTop: `1px solid ${COLORS.inkLine}`,
    fontSize: 11.5,
    color: COLORS.mutedOnInk,
    fontFamily: fontMono,
  },
  statusDivider: { color: COLORS.inkLine },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,11,16,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modalCard: {
    background: COLORS.paper,
    borderRadius: 16,
    padding: 24,
    width: 380,
    maxWidth: '90vw',
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
    animation: 'modalIn 0.2s ease-out',
  },
  modalTitle: { fontFamily: fontVoice, fontSize: 19, margin: '0 0 6px', color: COLORS.textOnPaper },
  modalSubtitle: { fontSize: 12.5, color: COLORS.mutedOnPaper, margin: '0 0 14px', lineHeight: 1.5 },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid rgba(36,31,22,0.2)`,
    fontSize: 14,
    fontFamily: fontSans,
    background: '#fff',
    color: COLORS.textOnPaper,
  },
  modalHint: { fontSize: 11.5, color: COLORS.brass, marginTop: 6, fontFamily: fontMono },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
  toast: {
    position: 'fixed',
    bottom: 50,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: COLORS.inkPanel,
    border: `1px solid`,
    color: COLORS.textOnInk,
    padding: '11px 16px',
    borderRadius: 10,
    fontSize: 13,
    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
    animation: 'toastIn 0.25s ease-out',
    zIndex: 60,
    maxWidth: 340,
  },
};