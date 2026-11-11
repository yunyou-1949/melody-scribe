/*
 * 旋律抄谱机 · Melody Scribe
 * 界面与交互：钢琴卷帘、编辑、播放、录音、MIDI 导出
 */
(function () {
  'use strict';

  const Core = window.MusicCore;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const TIMBRES = [
    { id: 'piano', label: '钢琴', program: 0 },
    { id: 'grand', label: '大钢琴', program: 0 },
    { id: 'acoustic', label: '木吉他', program: 24 },
    { id: 'bass', label: '贝斯', program: 33 },
    { id: 'drums', label: '鼓组', program: 0, drum: true },
    { id: 'cello', label: '大提琴', program: 42 },
    { id: 'recorder', label: '竖笛', program: 74 },
    { id: 'guitar', label: '清音电吉他', program: 27 },
    { id: 'distortion', label: '失真电吉他', program: 30 },
    { id: 'sax', label: '萨克斯', program: 65 },
    { id: 'violin', label: '小提琴', program: 40 },
  ];

  const DRUM_NAMES = {
    35: '低音大鼓', 36: '大鼓', 37: '鼓边', 38: '军鼓', 39: '拍手', 40: '电军鼓',
    41: '低落地嗵', 42: '闭镲', 43: '高落地嗵', 44: '踩镲', 45: '低嗵鼓',
    46: '开镲', 47: '中低嗵', 48: '中高嗵', 49: '吊镲', 50: '高嗵鼓',
    51: '叮叮镲', 52: '中国镲', 53: '叮叮铃', 54: '铃鼓', 55: '水镲',
    56: '牛铃', 57: '吊镲2', 58: '颤音器', 59: '叮叮镲2', 60: '高邦戈',
    61: '低邦戈', 62: '闷康加', 63: '高康加', 64: '低康加', 65: '高定音鼓',
    66: '低定音鼓', 67: '高阿戈戈', 68: '低阿戈戈', 69: '沙锤', 70: '沙铃',
    71: '短哨', 72: '长哨', 73: '短刮器', 74: '长刮器', 75: '木鱼',
    76: '高木鱼', 77: '低木鱼', 78: '闷巴西鼓', 79: '开巴西鼓',
    80: '闷三角铁', 81: '开三角铁',
  };

  const TIMBRE_RANGES = {
    piano: [21, 108],
    grand: [21, 108],
    acoustic: [40, 88],
    bass: [28, 67],
    drums: [35, 59],
    cello: [36, 76],
    recorder: [65, 98],
    guitar: [40, 88],
    distortion: [40, 88],
    sax: [49, 90],
    violin: [55, 100],
  };

  const MMC_DRUM_NAMES = {
    49: '吊镲',
    50: '高嗵鼓',
    51: '叮叮镲',
  };

  function mmcRowDisabled(midi) {
    if (!state.mmcFormat) return false;
    if (TIMBRES[state.timbre].drum) return !MMC_DRUM_NAMES[midi];
    const range = TIMBRE_RANGES[TIMBRES[state.timbre].id];
    return !!range && (midi < range[0] || midi > range[1]);
  }

  function notePart(n) {
    const raw = n.part || (n.midi <= 50 ? 'bass' : n.midi >= 72 ? 'melody' : 'harmony');
    if (raw === 'mid') return 'harmony';
    if (raw === 'high') return 'melody';
    return raw;
  }

  function partColor(part) {
    if (part === 'bass') return 196;
    if (part === 'melody') return 88;
    if (part === 'drums') return 8;
    return 44;
  }

  function rowLabel(midi) {
    if (TIMBRES[state.timbre].drum) {
      if (state.mmcFormat) return MMC_DRUM_NAMES[midi] || '未定义';
      return DRUM_NAMES[midi] || '未定义';
    }
    return Core.midiToName(midi);
  }

  const SENSITIVITY_PRESETS = [
    { level: 1, label: '保守', confidence: 0.64, yin: 0.13, rms: 1.35, minDur: 0.075, minFrames: 4 },
    { level: 2, label: '较稳', confidence: 0.58, yin: 0.15, rms: 1.15, minDur: 0.065, minFrames: 3 },
    { level: 3, label: '标准', confidence: 0.52, yin: 0.17, rms: 1.0, minDur: 0.055, minFrames: 3 },
    { level: 4, label: '灵敏', confidence: 0.42, yin: 0.23, rms: 0.75, minDur: 0.048, minFrames: 2 },
    { level: 5, label: '极灵敏', confidence: 0.3, yin: 0.3, rms: 0.5, minDur: 0.04, minFrames: 2 },
  ];

  const POLY_PRESETS = [
    { onset: 0.55, frame: 0.48, minLength: 7, amplitude: 0.3 },
    { onset: 0.48, frame: 0.42, minLength: 6, amplitude: 0.25 },
    { onset: 0.4, frame: 0.35, minLength: 5, amplitude: 0.2 },
    { onset: 0.32, frame: 0.28, minLength: 4, amplitude: 0.14 },
    { onset: 0.24, frame: 0.22, minLength: 3, amplitude: 0.08 },
  ];

  const els = {
    app: $('.app'),
    topbar: $('.topbar'),
    fileChip: $('#fileChip'),
    fileName: $('#fileName'),
    fileMeta: $('#fileMeta'),
    fileInput: $('#fileInput'),
    recordBtn: $('#recordBtn'),
    demoBtn: $('#demoBtn'),
    analyzeBtn: $('#analyzeBtn'),
    exportMidiBtn: $('#exportMidiBtn'),
    waveStrip: $('#waveStrip'),
    waveCanvas: $('#waveCanvas'),
    waveInfo: $('#waveInfo'),
    wavePlayhead: $('#wavePlayhead'),
    waveView: $('#waveView'),
    simplifyMiniBtn: $('#simplifyMiniBtn'),
    transWavBtn: $('#transWavBtn'),
    sourceWavBtn: $('#sourceWavBtn'),
    sourceDownloadBtn: $('#sourceDownloadBtn'),
    originalBtn: $('#originalBtn'),
    pitchLabels: $('#pitchLabels'),
    gridScroll: $('#gridScroll'),
    canvasWrap: $('#canvasWrap'),
    rollCanvas: $('#rollCanvas'),
    playhead: $('#playhead'),
    emptyHint: $('#emptyHint'),
    rollBody: $('.roll-body'),
    rollPanel: $('.roll-panel'),
    statusBpm: $('#statusBpm'),
    statusBpmValue: $('#statusBpmValue'),
    statusMeter: $('#statusMeter'),
    statusMeterValue: $('#statusMeterValue'),
    statusRange: $('#statusRange'),
    statusGrid: $('#statusGrid'),
    prevNoteBtn: $('#prevNoteBtn'),
    nextNoteBtn: $('#nextNoteBtn'),
    statusTimbre: $('#statusTimbre'),
    mmcBtn: $('#mmcBtn'),
    timbreMenu: $('#timbreMenu'),
    snapshotBtn: $('#snapshotBtn'),
    playBtn: $('#playBtn'),
    playFromBtn: $('#playFromBtn'),
    stopBtn: $('#stopBtn'),
    transposeUpBtn: $('#transposeUpBtn'),
    transposeDownBtn: $('#transposeDownBtn'),
    copyBtn: $('#copyBtn'),
    undoBtn: $('#undoBtn'),
    redoBtn: $('#redoBtn'),
    deleteBtn: $('#deleteBtn'),
    dottedBtn: $('#dottedBtn'),
    bpmInput: $('#bpmInput'),
    modeSelect: $('#modeSelect'),
    engineSelect: $('#engineSelect'),
    engineHint: $('#engineHint'),
    meterSelect: $('#meterSelect'),
    gridSelect: $('#gridSelect'),
    quantizeInput: $('#quantizeInput'),
    sensitivityInput: $('#sensitivityInput'),
    sensitivityLabel: $('#sensitivityLabel'),
    brightInput: $('#brightInput'),
    brightValue: $('#brightValue'),
    reverbInput: $('#reverbInput'),
    reverbValue: $('#reverbValue'),
    tuningInput: $('#tuningInput'),
    tuningValue: $('#tuningValue'),
    reflowBtn: $('#reflowBtn'),
    fineBtn: $('#fineBtn'),
    previewBtn: $('#previewBtn'),
    previewInput: $('#previewInput'),
    simplifyBtn: $('#simplifyBtn'),
    instrumentTopBtn: $('#instrumentTopBtn'),
    recognizeBtn: $('#recognizeBtn'),
    openExportBtn: $('#openExportBtn'),
    ncmConvertBtn: $('#ncmConvertBtn'),
    ncmInput: $('#ncmInput'),
    midiImportBtn: $('#midiImportBtn'),
    midiInput: $('#midiInput'),
    sheetsageBtn: $('#sheetsageBtn'),
    instrumentTracks: $('#instrumentTracks'),
    instrumentHint: $('#instrumentHint'),
    overlay: $('#overlay'),
    overlayTitle: $('#overlayTitle'),
    overlayText: $('#overlayText'),
    overlayProgress: $('#overlayProgress'),
    overlayBar: $('#overlayBar'),
    overlayPercent: $('#overlayPercent'),
    overlayEta: $('#overlayEta'),
    modePrompt: $('#modePrompt'),
    modePromptText: $('#modePromptText'),
    modeOfflineBtn: $('#modeOfflineBtn'),
    modeOnlineBtn: $('#modeOnlineBtn'),
    modeCancelBtn: $('#modeCancelBtn'),
    engineGuide: $('#engineGuide'),
    engineExistingBtn: $('#engineExistingBtn'),
    engineDownloadBtn: $('#engineDownloadBtn'),
    engineOfflineBtn: $('#engineOfflineBtn'),
    engineGuideCancelBtn: $('#engineGuideCancelBtn'),
    engineInstallStatus: $('#engineInstallStatus'),
    recordPill: $('#recordPill'),
    recordTime: $('#recordTime'),
    recordStopBtn: $('#recordStopBtn'),
    toast: $('#toast'),
  };

  const state = {
    // 工程
    previewBuffer: null,
    previewName: '',
    notes: [],
    rawNotes: [],
    measures: 4,
    bpm: 120,
    beatsPerBar: 4,
    beatUnit: 4,
    divisions: 4,
    quantize: true,
    sensitivity: 3,
    brightness: 3,
    reverb: 16,
    tuning: 20,
    recognitionMode: 'poly',
    recognitionEngine: 'offline',
    origin: 0,
    beatDur: 0.5,
    barDur: 2,
    step: 0.125,
    dirty: false,

    // 编辑
    tool: 'pencil',
    noteLength: 1,
    dotted: false,
    velocity: 88,
    selected: new Set(),
    mutedParts: new Set(),
    instrumentTracks: [],
    zoom: 1,
    hover: null,
    marquee: null,
    drag: null,
    clipboard: [],

    // 音频
    samples: null,
    sampleRate: 44100,
    audioBuffer: null,
    audioDuration: 0,
    audioName: '',
    sourceBlob: null,
    cpuFallbackTried: false,
    sourceName: '',
    wavePeaks: null,
    analysis: null,

    // 视图 / 播放
    lowMidi: 48,
    highMidi: 71,
    cellW: 21,
    rowH: 16,
    headerH: 56,
    timelineWidth: 0,
    viewW: 0,
    scrollLeft: 0,
    playhead: 0,
    playing: false,
    playMode: null,
    playFrom: 0,
    playStartCtx: 0,
    timbre: 1,
    autoTimbre: true,
    mmcFormat: false,

    // 状态
    analyzing: false,
    renderingWav: false,
    recording: false,
  };

  let audioCtx = null;
  let masterGain = null;
  let toneBright = null;
  let toneWet = null;
  let toneDry = null;
  let activeNodes = [];
  let originalSource = null;
  let previewSource = null;
  let playbackSource = null;
  let playbackBuffer = null;
  let playbackBufferKey = '';
  let playbackRendering = false;
  let rafId = 0;
  let toastTimer = 0;
  let resizeTimer = 0;
  let gridScrollRaf = 0;
  let recordTimer = 0;
  let mediaRecorder = null;
  let mediaStream = null;
  let recordChunks = [];
  let recordStartedAt = 0;
  let scheduleTimer = 0;
  let scheduleIndex = 0;
  let playbackNotes = [];
  let undoStack = [];
  let redoStack = [];
  let labelsKey = '';
  let lastCanvasW = 0;
  let lastCanvasH = 0;
  let dragMoved = false;

  /* ====================================================================== */
  /* 启动                                                                   */
  /* ====================================================================== */

  init();

  function init() {
    bindEvents();
    updateTiming();
    syncControls();
    requestAnimationFrame(() => {
      renderAll();
      if (/[?&]demo(?:[=&]|$)/.test(location.search)) {
        setTimeout(loadDemo, 260);
      }
    });
  }

  function bindEvents() {
    els.fileChip.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', () => {
      const f = els.fileInput.files && els.fileInput.files[0];
      if (f) handleFile(f);
      els.fileInput.value = '';
    });

    els.demoBtn.addEventListener('click', loadDemo);
    els.recordBtn.addEventListener('click', () => {
      if (state.recording) stopRecording();
      else startRecording();
    });
    els.recordStopBtn.addEventListener('click', stopRecording);
    els.analyzeBtn.addEventListener('click', analyzeCurrent);
    els.exportMidiBtn.addEventListener('click', exportMidi);
    els.snapshotBtn.addEventListener('click', exportSnapshot);

    $$('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });
    $$('.len-btn[data-length]').forEach((btn) => {
      btn.addEventListener('click', () => applyLength(parseFloat(btn.dataset.length)));
    });
    els.dottedBtn.addEventListener('click', toggleDotted);
    $$('.vel-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyVelocity(parseInt(btn.dataset.velocity, 10)));
    });

    els.playBtn.addEventListener('click', () => {
      if (state.playing) stopPlayback(true);
      else startPlayback('notes', state.playhead);
    });
    els.playFromBtn.addEventListener('click', () => {
      if (state.playing) stopPlayback(false);
      startPlayback('notes', state.playhead);
    });
    els.stopBtn.addEventListener('click', () => stopPlayback(true));
    els.originalBtn.addEventListener('click', () => {
      if (state.playing && state.playMode === 'original') stopPlayback(true);
      else startPlayback('original', state.playhead);
    });
    els.sourceDownloadBtn.addEventListener('click', exportSourceAudio);
    els.sourceWavBtn.addEventListener('click', exportSourceWav);
    els.transWavBtn.addEventListener('click', exportTranscriptionWav);
    els.simplifyMiniBtn.addEventListener('click', simplifyPoly);

    els.transposeUpBtn.addEventListener('click', () => transposeSelected(1));
    els.transposeDownBtn.addEventListener('click', () => transposeSelected(-1));
    els.copyBtn.addEventListener('click', copySelection);
    els.deleteBtn.addEventListener('click', deleteSelected);
    els.undoBtn.addEventListener('click', undo);
    els.redoBtn.addEventListener('click', redo);
    els.reflowBtn.addEventListener('click', () => reflow({ force: false, push: true }));
    els.fineBtn.addEventListener('click', onFineAnalyze);
    els.previewBtn.addEventListener('click', () => els.previewInput.click());
    els.previewInput.addEventListener('change', handlePreviewFile);
    els.simplifyBtn.addEventListener('click', simplifyPoly);
    els.recognizeBtn.addEventListener('click', recognizeInstruments);
    els.openExportBtn.addEventListener('click', openExportFolder);
    els.ncmConvertBtn.addEventListener('click', () => els.ncmInput.click());
    els.ncmInput.addEventListener('change', () => {
      const f = els.ncmInput.files && els.ncmInput.files[0];
      els.ncmInput.value = '';
      if (f) convertNcmFile(f);
    });
    els.midiImportBtn.addEventListener('click', () => els.midiInput.click());
    els.midiInput.addEventListener('change', () => {
      const f = els.midiInput.files && els.midiInput.files[0];
      els.midiInput.value = '';
      if (f) handleFile(f);
    });
    els.sheetsageBtn.addEventListener('click', runSheetSage);
    els.modeOfflineBtn.addEventListener('click', () => chooseRecognitionMode('offline'));
    els.modeOnlineBtn.addEventListener('click', () => chooseRecognitionMode('online'));
    els.modeCancelBtn.addEventListener('click', hideModePrompt);
    els.engineExistingBtn.addEventListener('click', () => {
      hideEngineGuide();
      runSheetSage(true);
    });
    els.engineDownloadBtn.addEventListener('click', () => {
      if (window.chrome && window.chrome.webview) {
        if (!window.confirm('将下载官方 SheetSage2 V2 启动包（约 87.6 MiB），并解压到 D:\\MelodyScribe\\SheetSage2。\n\n首次安装还会下载约 6 GB 环境与模型。继续吗？')) return;
        if (els.engineInstallStatus) els.engineInstallStatus.textContent = '准备下载官方 V2 启动包…';
        window.chrome.webview.postMessage('installSheetSageV2');
      } else {
        window.open('https://github.com/3253473591/sheetsage2-webui/releases/tag/v2.0-beta2', '_blank');
      }
    });
    els.engineOfflineBtn.addEventListener('click', () => {
      hideEngineGuide();
      chooseRecognitionMode('offline');
    });
    els.engineGuideCancelBtn.addEventListener('click', hideEngineGuide);
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || data.action !== 'sheetSageInstall') return;
        if (els.engineInstallStatus) {
          els.engineInstallStatus.textContent = data.message || '';
          els.engineInstallStatus.style.color = data.stage === 'error' ? '#a33d28' : '#5e4b2c';
        }
        if (data.stage === 'ready') {
          setTimeout(() => {
            hideEngineGuide();
            runSheetSage(true);
          }, 800);
        }
      });
    }
    els.instrumentTopBtn.addEventListener('click', recognizeInstruments);

    els.bpmInput.addEventListener('change', onBpmChange);
    document.querySelectorAll('.part-toggle').forEach((el) => {
      el.addEventListener('click', () => {
        const part = el.dataset.part;
        if (state.mutedParts.has(part)) state.mutedParts.delete(part);
        else state.mutedParts.add(part);
        el.classList.toggle('muted', state.mutedParts.has(part));
        renderInstrumentTracks();
        renderAll();
      });
    });
    els.modeSelect.addEventListener('change', onModeChange);
    els.engineSelect.addEventListener('change', onEngineChange);
    els.meterSelect.addEventListener('change', onMeterChange);
    els.gridSelect.addEventListener('change', onGridChange);
    els.quantizeInput.addEventListener('change', onQuantizeChange);
    els.sensitivityInput.addEventListener('input', onSensitivityChange);
    els.brightInput.addEventListener('input', onToneChange);
    els.reverbInput.addEventListener('input', onToneChange);
    els.tuningInput.addEventListener('input', onToneChange);

    els.statusBpm.addEventListener('click', focusBpm);
    els.statusMeter.addEventListener('click', focusMeter);
    els.statusTimbre.addEventListener('click', toggleTimbreMenu);
    els.mmcBtn.addEventListener('click', toggleMmcFormat);
    document.addEventListener('pointerdown', (e) => {
      if (els.timbreMenu && !els.timbreMenu.hidden &&
          !els.timbreMenu.contains(e.target) && !els.statusTimbre.contains(e.target)) {
        els.timbreMenu.hidden = true;
      }
    });
    els.prevNoteBtn.addEventListener('click', () => jumpToNote(-1));
    els.nextNoteBtn.addEventListener('click', () => jumpToNote(1));

    els.rollCanvas.addEventListener('pointerdown', onPointerDown);
    els.rollCanvas.addEventListener('dblclick', (e) => {
      const hit = noteAtPoint(pointFromEvent(e));
      if (hit) {
        e.preventDefault();
        previewNote(hit);
      }
    });
    els.rollCanvas.title = '双击音符试音 · 自然衰减';
    els.rollCanvas.addEventListener('pointermove', onPointerMove);
    els.rollCanvas.addEventListener('pointerup', onPointerUp);
    els.rollCanvas.addEventListener('pointercancel', onPointerUp);
    els.rollCanvas.addEventListener('pointerleave', onPointerLeave);
    els.rollCanvas.addEventListener('contextmenu', onContextMenu);
    els.rollCanvas.addEventListener('wheel', onCanvasWheel, { passive: false });

    els.waveCanvas.addEventListener('pointerdown', onWaveClick);
    els.gridScroll.addEventListener('scroll', onGridScroll);
    window.addEventListener('resize', scheduleResize);

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeunload', () => {
      try { if (state.playing) stopPlayback(false); } catch (e) {}
      try { if (audioCtx && audioCtx.state === 'running') audioCtx.suspend(); } catch (e) {}
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.recording) stopRecording();
    });

    // 空闲时预热复音模型：首次识别不再从零加载
    const warmModel = () => {
      const bp = window.BasicPitchTranscriber;
      if (!bp) return;
      let forceCpu = false;
      try { forceCpu = localStorage.getItem('ms_force_cpu') === '1'; } catch (e) {}
      if (forceCpu && bp.useCpu) {
        bp.useCpu().then(() => bp.ready()).catch(() => {});
      } else if (bp.ready) {
        bp.ready().catch(() => {});
      }
    };
    if (window.requestIdleCallback) setTimeout(() => requestIdleCallback(warmModel, { timeout: 2500 }), 1200);
    else setTimeout(warmModel, 1800);
  }

  /* ====================================================================== */
  /* 音频载入 / 识别                                                        */
  /* ====================================================================== */

  async function handlePreviewFile() {
    const file = els.previewInput.files && els.previewInput.files[0];
    els.previewInput.value = '';
    if (!file) return;
    try {
      const ctx = ensureAudioContext();
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      state.previewBuffer = buf;
      state.previewName = file.name;
      els.previewBtn.textContent = '试听轨：' + file.name.replace(/\.[^.]+$/, '').slice(0, 12);
      showToast('已载入生成试听轨；按左侧播放键会直接播放这份音频', 'success');
    } catch (err) {
      console.error(err);
      showToast('试听轨载入失败：' + err.message, 'error');
    }
  }

  const NCM_CORE_KEY = new TextEncoder().encode('hzHRAmso5kInbaxW');
  const NCM_KEY_PREFIX = 'neteasecloudmusic';
  let ncmSBox = null;
  let ncmInvSBox = null;

  function ncmXtime(a) {
    return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff;
  }

  function ncmGmul(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) p ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1b;
      b >>= 1;
    }
    return p;
  }

  function ncmGfPow(a, n) {
    let r = 1;
    while (n) {
      if (n & 1) r = ncmGmul(r, a);
      a = ncmGmul(a, a);
      n >>= 1;
    }
    return r;
  }

  function ncmRotl8(x, n) {
    return ((x << n) | (x >> (8 - n))) & 0xff;
  }

  function ncmInitSBox() {
    if (ncmSBox) return;
    ncmSBox = new Uint8Array(256);
    ncmInvSBox = new Uint8Array(256);
    for (let a = 0; a < 256; a++) {
      const inv = a ? ncmGfPow(a, 254) : 0;
      const s = (inv ^ ncmRotl8(inv, 1) ^ ncmRotl8(inv, 2) ^
        ncmRotl8(inv, 3) ^ ncmRotl8(inv, 4) ^ 0x63) & 0xff;
      ncmSBox[a] = s;
      ncmInvSBox[s] = a;
    }
  }

  function ncmExpandKey(key) {
    ncmInitSBox();
    const w = new Uint8Array(176);
    w.set(key);
    let rcon = 1;
    for (let i = 16; i < 176; i += 4) {
      let t = [w[i - 4], w[i - 3], w[i - 2], w[i - 1]];
      if (i % 16 === 0) {
        t = [t[1], t[2], t[3], t[0]].map((v) => ncmSBox[v]);
        t[0] ^= rcon;
        rcon = ncmXtime(rcon);
      }
      for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
    }
    return w;
  }

  function ncmAddRoundKey(s, w, round) {
    for (let i = 0; i < 16; i++) s[i] ^= w[round * 16 + i];
  }

  function ncmInvShiftRows(s) {
    const t = s.slice();
    for (let r = 1; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        s[r + 4 * c] = t[r + 4 * ((c - r + 4) % 4)];
      }
    }
  }

  function ncmInvSubBytes(s) {
    for (let i = 0; i < 16; i++) s[i] = ncmInvSBox[s[i]];
  }

  function ncmInvMixColumns(s) {
    for (let c = 0; c < 4; c++) {
      const a0 = s[4 * c], a1 = s[4 * c + 1], a2 = s[4 * c + 2], a3 = s[4 * c + 3];
      s[4 * c] = ncmGmul(a0, 14) ^ ncmGmul(a1, 11) ^ ncmGmul(a2, 13) ^ ncmGmul(a3, 9);
      s[4 * c + 1] = ncmGmul(a0, 9) ^ ncmGmul(a1, 14) ^ ncmGmul(a2, 11) ^ ncmGmul(a3, 13);
      s[4 * c + 2] = ncmGmul(a0, 13) ^ ncmGmul(a1, 9) ^ ncmGmul(a2, 14) ^ ncmGmul(a3, 11);
      s[4 * c + 3] = ncmGmul(a0, 11) ^ ncmGmul(a1, 13) ^ ncmGmul(a2, 9) ^ ncmGmul(a3, 14);
    }
  }

  function ncmDecryptBlock(block, w) {
    const s = Uint8Array.from(block);
    ncmAddRoundKey(s, w, 10);
    for (let round = 9; round >= 1; round--) {
      ncmInvShiftRows(s);
      ncmInvSubBytes(s);
      ncmAddRoundKey(s, w, round);
      ncmInvMixColumns(s);
    }
    ncmInvShiftRows(s);
    ncmInvSubBytes(s);
    ncmAddRoundKey(s, w, 0);
    return s;
  }

  function ncmAesDecrypt(cipher, key) {
    if (!cipher.length || cipher.length % 16 !== 0) throw new Error('NCM 密钥长度不正确');
    const w = ncmExpandKey(key);
    const out = new Uint8Array(cipher.length);
    for (let i = 0; i < cipher.length; i += 16) {
      out.set(ncmDecryptBlock(cipher.subarray(i, i + 16), w), i);
    }
    const pad = out[out.length - 1];
    if (pad < 1 || pad > 16 || pad > out.length) throw new Error('NCM 密钥解密失败');
    return out.subarray(0, out.length - pad);
  }

  function ncmReadU32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function decodeNcm(arrayBuffer, onProgress) {
    const bytes = new Uint8Array(arrayBuffer);
    const magic = String.fromCharCode.apply(null, bytes.subarray(0, 8));
    if (magic !== 'CTENFDAM') throw new Error('不是有效的网易云 NCM 文件');
    let offset = 10;
    const keyLen = ncmReadU32(bytes, offset); offset += 4;
    if (keyLen <= 0 || keyLen > 1024 || offset + keyLen > bytes.length) throw new Error('NCM 密钥段损坏');
    const keyBlob = Uint8Array.from(bytes.subarray(offset, offset + keyLen));
    offset += keyLen;
    for (let i = 0; i < keyBlob.length; i++) keyBlob[i] ^= 0x64;
    const keyPlain = ncmAesDecrypt(keyBlob, NCM_CORE_KEY);
    const prefix = String.fromCharCode.apply(null, keyPlain.subarray(0, NCM_KEY_PREFIX.length));
    if (prefix !== NCM_KEY_PREFIX) throw new Error('NCM 密钥校验失败');
    const streamKey = keyPlain.subarray(NCM_KEY_PREFIX.length);
    if (!streamKey.length) throw new Error('NCM 密钥为空');

    const metaLen = ncmReadU32(bytes, offset); offset += 4;
    if (offset + metaLen > bytes.length) throw new Error('NCM 元数据段损坏');
    offset += metaLen;
    offset += 9;
    if (offset + 4 > bytes.length) throw new Error('NCM 封面段缺失');
    const coverLen = ncmReadU32(bytes, offset); offset += 4;
    if (offset + coverLen > bytes.length) throw new Error('NCM 封面段损坏');
    offset += coverLen;
    if (offset >= bytes.length) throw new Error('NCM 音频段为空');

    const audio = Uint8Array.from(bytes.subarray(offset));
    const sBox = new Uint8Array(256);
    for (let i = 0; i < 256; i++) sBox[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + sBox[i] + streamKey[i % streamKey.length]) & 0xff;
      const t = sBox[i]; sBox[i] = sBox[j]; sBox[j] = t;
    }
    for (let i = 0; i < audio.length; i++) {
      const jj = (i + 1) & 0xff;
      const a = sBox[jj];
      const b = sBox[(a + jj) & 0xff];
      audio[i] ^= sBox[(a + b) & 0xff];
      if (onProgress && (i & 0xfffff) === 0) onProgress(i / audio.length);
    }
    if (onProgress) onProgress(1);

    let format = 'mp3';
    if (audio[0] === 0x66 && audio[1] === 0x4c && audio[2] === 0x61 && audio[3] === 0x43) {
      format = 'flac';
    } else if (audio.length > 8 && audio[4] === 0x66 && audio[5] === 0x74 && audio[6] === 0x79 && audio[7] === 0x70) {
      format = 'm4a';
    }
    return { audio, format };
  }

  function parseMidiFile(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let p = 0;
    const ascii = (n) => {
      const s = String.fromCharCode.apply(null, bytes.subarray(p, p + n));
      p += n;
      return s;
    };
    const u16 = () => {
      const v = (bytes[p] << 8) | bytes[p + 1];
      p += 2;
      return v;
    };
    const u32 = () => {
      const v = ((bytes[p] << 24) | (bytes[p + 1] << 16) |
        (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
      p += 4;
      return v;
    };
    const varLen = () => {
      let v = 0;
      for (let i = 0; i < 4; i++) {
        const b = bytes[p++];
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return v;
    };
    if (ascii(4) !== 'MThd') throw new Error('不是有效的 MIDI 文件');
    const headerLen = u32();
    const format = u16();
    const trackCount = u16();
    const division = u16();
    if (division & 0x8000) throw new Error('暂不支持 SMPTE 时间格式的 MIDI');
    p += Math.max(0, headerLen - 6);
    const tempos = [{ tick: 0, us: 500000 }];
    const rawNotes = [];
    for (let t = 0; t < trackCount && p + 8 <= bytes.length; t++) {
      if (ascii(4) !== 'MTrk') break;
      const trackEnd = p + 4 + u32();
      let tick = 0;
      let running = 0;
      const active = new Map();
      while (p < trackEnd) {
        tick += varLen();
        if (p >= trackEnd) break;
        let status = bytes[p++];
        if (status < 0x80) {
          if (!running) break;
          p--;
          status = running;
        } else if (status < 0xf0) {
          running = status;
        }
        const type = status >> 4;
        const channel = status & 0x0f;
        if (status === 0xff) {
          const meta = bytes[p++];
          const len = varLen();
          if (meta === 0x51 && len === 3) {
            const us = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2];
            if (us > 0) tempos.push({ tick, us });
          }
          p += len;
        } else if (status === 0xf0 || status === 0xf7) {
          p += varLen();
        } else if (type === 0x9 || type === 0x8) {
          const pitch = bytes[p++];
          const velocity = bytes[p++];
          const key = channel + ':' + pitch;
          if (type === 0x9 && velocity > 0) {
            active.set(key, { tick, pitch, velocity });
          } else {
            const hit = active.get(key);
            if (hit) {
              rawNotes.push({
                startTick: hit.tick,
                endTick: tick,
                midi: hit.pitch,
                velocity: hit.velocity,
              });
              active.delete(key);
            }
          }
        } else if (type === 0xa || type === 0xb || type === 0xe) {
          p += 2;
        } else if (type === 0xc || type === 0xd) {
          p += 1;
        } else {
          break;
        }
      }
      p = trackEnd;
      for (const hit of active.values()) {
        rawNotes.push({
          startTick: hit.tick,
          endTick: tick,
          midi: hit.pitch,
          velocity: hit.velocity,
        });
      }
    }
    tempos.sort((a, b) => a.tick - b.tick || a.us - b.us);
    const tickToSec = (target) => {
      let sec = 0;
      let lastTick = 0;
      let us = 500000;
      for (const ev of tempos) {
        if (ev.tick >= target) break;
        sec += ((ev.tick - lastTick) * us) / (division * 1e6);
        lastTick = ev.tick;
        us = ev.us;
      }
      return sec + ((target - lastTick) * us) / (division * 1e6);
    };
    const notes = rawNotes
      .map((n) => {
        const start = tickToSec(n.startTick);
        const end = Math.max(start + 0.04, tickToSec(n.endTick));
        return {
          start,
          end,
          duration: end - start,
          midi: n.midi,
          velocity: Core.clamp(n.velocity, 1, 127),
          part: n.midi <= 50 ? 'bass' : n.midi >= 72 ? 'melody' : 'harmony',
        };
      })
      .sort((a, b) => a.start - b.start || a.midi - b.midi);
    if (!notes.length) throw new Error('MIDI 里没有音符');
    const bpm = 60e6 / tempos[0].us;
    const duration = notes[notes.length - 1].end;
    return { notes, bpm, duration, format, trackCount };
  }

  const SHEETSAGE_API = 'http://127.0.0.1:8777';
  const SHEETSAGE_V2_API = 'http://127.0.0.1:8000';
  let sheetsageRunning = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function detectSheetSageApi() {
    try {
      const v2 = await fetch(SHEETSAGE_V2_API + '/api/healthz', { cache: 'no-store' });
      if (v2.ok) return 'v2';
    } catch (e) { /* try v1 */ }
    try {
      const v1 = await fetch(SHEETSAGE_API + '/api/health', { cache: 'no-store' });
      if (v1.ok) return 'v1';
    } catch (e) { /* none */ }
    return null;
  }

  async function sheetSageFetch(path, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 3000);
    try {
      return await fetch(SHEETSAGE_API + path, {
        ...(options || {}),
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function sheetSageV2Fetch(path, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 3000);
    try {
      return await fetch(SHEETSAGE_V2_API + path, {
        ...(options || {}),
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureSheetSage() {
    const existing = await detectSheetSageApi();
    if (existing) return existing;
    if (!window.chrome || !window.chrome.webview) {
      throw new Error('请使用 Windows 独立窗口版；浏览器版无法启动本地 SheetSage2');
    }
    window.chrome.webview.postMessage('startSheetSage');
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const api = await detectSheetSageApi();
      if (api) return api;
      if (i % 5 === 0) {
        setOverlayLoading('等待 SheetSage2 服务启动 · ' + (i + 1) + 's');
      }
    }
    throw new Error('SheetSage2 没有启动成功。请确认已安装 WebUI，且 8777 / 8000 端口没有被旧的 SheetSage2 占用');
  }

  async function audioForSheetSage() {
    let blob = state.sourceBlob;
    let name = state.sourceName || state.audioName || 'audio.wav';
    const ext = ((name.match(/\.[^.]+$/) || ['.wav'])[0] || '.wav').toLowerCase();
    if (!blob || ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac'].indexOf(ext) < 0) {
      const wav = Core.encodeWav(state.samples, state.sampleRate);
      blob = new Blob([wav], { type: 'audio/wav' });
      name = baseName() + '.wav';
    }
    return { blob, name };
  }

  function applySheetSageRoll(roll) {
    const notes = [];
    for (const track of (roll.tracks || [])) {
      if (track.kind === 'chords') continue;
      for (const n of (track.notes || [])) {
        const start = Number(n.start);
        const end = Number(n.end);
        const midi = Math.round(Number(n.pitch));
        if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(midi)) continue;
        if (end <= start || midi < 12 || midi > 120) continue;
        notes.push({
          start: Math.max(0, start),
          end: Math.max(start + 0.04, end),
          duration: Math.max(0.04, end - start),
          midi,
          velocity: 96,
          part: midi <= 50 ? 'bass' : midi >= 72 ? 'melody' : 'harmony',
        });
      }
    }
    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
    if (!notes.length) throw new Error('SheetSage2 返回的谱面没有音符');
    const stamp = Date.now().toString(36);
    state.notes = notes.map((n, i) => ({ ...n, id: 'ss' + stamp + '_' + i }));
    state.rawNotes = state.notes.map((n) => ({ ...n }));
    state.bpm = normaliseBpm(Number(roll.bpm) || state.bpm);
    state.origin = 0;
    state.audioDuration = Math.max(state.audioDuration || 0, notes[notes.length - 1].end);
    updateTiming();
    state.measures = Math.max(4, Math.ceil(state.audioDuration / state.barDur));
    extendMeasuresToFit();
    fitPitchRange(state.notes);
    state.instrumentTracks = [];
    state.mutedParts.clear();
    state.selected.clear();
    state.analysis = { mode: 'sheetsage', bpm: state.bpm, duration: state.audioDuration };
    state.dirty = false;
    renderAll();
    chooseAutoTimbre();
    return notes.length;
  }

  function applyMidiToCurrent(midi) {
    const stamp = Date.now().toString(36);
    state.notes = midi.notes.map((n, i) => ({ ...n, id: 'v2m' + stamp + '_' + i }));
    state.rawNotes = state.notes.map((n) => ({ ...n }));
    state.bpm = normaliseBpm(midi.bpm || state.bpm);
    state.origin = 0;
    state.audioDuration = Math.max(state.audioDuration || 0, midi.duration || 0);
    updateTiming();
    state.measures = Math.max(4, Math.ceil(state.audioDuration / state.barDur));
    extendMeasuresToFit();
    fitPitchRange(state.notes);
    state.instrumentTracks = [];
    state.mutedParts.clear();
    state.selected.clear();
    state.analysis = { mode: 'sheetsage-v2', bpm: state.bpm, duration: state.audioDuration };
    state.dirty = false;
    renderAll();
    chooseAutoTimbre();
    return state.notes.length;
  }

  async function runSheetSageV2() {
    showOverlay('SheetSage2 V2 高精度识别', '上传音频到本机 V2 服务…');
    setOverlayLoading('上传音频');
    const audio = await audioForSheetSage();
    const form = new FormData();
    form.append('file', audio.blob, audio.name);
    const jobRes = await sheetSageV2Fetch('/api/jobs', { method: 'POST', body: form }, 180000);
    if (!jobRes.ok) throw new Error('V2 建工程失败：HTTP ' + jobRes.status + ' ' + (await jobRes.text()).slice(0, 160));
    let job = await jobRes.json();
    const jobId = job.id;
    if (!jobId) throw new Error('V2 没有返回工程 id');

    const startRes = await sheetSageV2Fetch('/api/jobs/' + encodeURIComponent(jobId) + '/stages/transcribe', {
      method: 'POST',
    }, 30000);
    if (!startRes.ok) throw new Error('V2 启动扒谱失败：HTTP ' + startRes.status + ' ' + (await startRes.text()).slice(0, 160));

    const started = Date.now();
    let stage = null;
    for (let i = 0; i < 3600; i++) {
      const res = await sheetSageV2Fetch('/api/jobs/' + encodeURIComponent(jobId), {}, 10000);
      if (!res.ok) throw new Error('V2 读取状态失败：HTTP ' + res.status);
      job = await res.json();
      stage = job.stages && job.stages.transcribe;
      const percent = Math.max(0, Math.min(100, Number(stage && stage.progress) * 100 || 0));
      const elapsed = (Date.now() - started) / 1000;
      setOverlayProgress(0.03 + percent * 0.009,
        'SheetSage2 V2 · ' + ((stage && (stage.step || stage.label)) || job.message || '处理中') +
        ' · ' + Math.round(percent) + '% · 已用 ' + formatDuration(elapsed));
      els.overlayText.textContent = ((stage && stage.step) || job.message || 'V2 正在扒谱') + ' · ' + Math.round(percent) + '%';
      if (stage && stage.state === 'done') break;
      if (stage && (stage.state === 'failed' || stage.state === 'cancelled')) {
        throw new Error(stage.error || 'V2 扒谱失败');
      }
      if (job.state === 'failed' || job.state === 'cancelled') {
        throw new Error(job.message || 'V2 任务失败');
      }
      await sleep(1500);
    }
    if (!stage || stage.state !== 'done') throw new Error('V2 扒谱超时');

    setOverlayProgress(0.97, '下载 V2 MIDI…');
    const midiRes = await sheetSageV2Fetch('/api/jobs/' + encodeURIComponent(jobId) + '/files/transcription.mid', {}, 60000);
    if (!midiRes.ok) throw new Error('V2 MIDI 下载失败：HTTP ' + midiRes.status);
    const midi = parseMidiFile(await midiRes.arrayBuffer());
    return applyMidiToCurrent(midi);
  }

  async function runSheetSage(force) {
    if (sheetsageRunning) return;
    if (!state.samples) {
      showToast('先打开一段音频，再使用 SheetSage2 高精度识别');
      return;
    }
    const existing = await detectSheetSageApi();
    if (!existing && !force) {
      showEngineGuide();
      return;
    }
    sheetsageRunning = true;
    updateControls();
    showOverlay('SheetSage2 高精度识别', '准备本地服务…');
    setOverlayLoading('启动本地服务');
    await nextPaint();
    try {
      const api = existing || await ensureSheetSage();
      if (api === 'v2') {
        const count = await runSheetSageV2();
        hideOverlay();
        showToast('SheetSage2 V2 高精度完成 · ' + count + ' 音符 · 可继续编辑/导出', 'success');
        return;
      }
      showOverlay('SheetSage2 高精度识别', '上传音频到本机服务…');
      setOverlayLoading('上传音频');
      const audio = await audioForSheetSage();
      const form = new FormData();
      form.append('file', audio.blob, audio.name);
      const upload = await sheetSageFetch('/api/upload', { method: 'POST', body: form }, 120000);
      if (!upload.ok) throw new Error('音频上传失败：HTTP ' + upload.status);
      const up = await upload.json();
      const taskRes = await sheetSageFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: up.token,
          preset: 'default',
          only_melody: false,
          export_voices: ['vocal', 'instrumental', 'chords'],
        }),
      }, 30000);
      if (!taskRes.ok) {
        const text = await taskRes.text();
        throw new Error('创建任务失败：' + text.slice(0, 200));
      }
      const task = await taskRes.json();
      const taskId = task.task_id;
      if (!taskId) throw new Error('SheetSage2 没有返回 task_id');

      const started = Date.now();
      let taskInfo = null;
      for (let i = 0; i < 3600; i++) {
        const stateRes = await sheetSageFetch('/api/state?task_id=' + encodeURIComponent(taskId), {}, 10000);
        if (!stateRes.ok) throw new Error('读取任务状态失败：HTTP ' + stateRes.status);
        const snapshot = await stateRes.json();
        taskInfo = snapshot.task;
        if (!taskInfo) throw new Error('SheetSage2 任务丢失');
        const percent = Math.max(0, Math.min(100, Number(taskInfo.percent) || 0));
        const elapsed = (Date.now() - started) / 1000;
        setOverlayProgress(0.03 + percent * 0.009,
          'SheetSage2 · ' + (taskInfo.stage || taskInfo.state_label || '处理中') +
          ' · ' + Math.round(percent) + '% · 已用 ' + formatDuration(elapsed));
        els.overlayText.textContent =
          (taskInfo.text || 'SheetSage2 正在扒谱') + ' · ' + Math.round(percent) + '%';
        if (taskInfo.state === 'done') break;
        if (taskInfo.state === 'failed' || taskInfo.state === 'cancelled') {
          throw new Error(taskInfo.error || ('SheetSage2 任务' + taskInfo.state_label));
        }
        await sleep(1500);
      }
      if (!taskInfo || taskInfo.state !== 'done') throw new Error('SheetSage2 任务超时');

      setOverlayProgress(0.96, '读取 SheetSage2 谱面…');
      const rollRes = await sheetSageFetch('/api/tasks/' + encodeURIComponent(taskId) + '/roll?only_melody=0', {}, 30000);
      if (!rollRes.ok) throw new Error('读取谱面失败：HTTP ' + rollRes.status);
      const roll = await rollRes.json();
      const count = applySheetSageRoll(roll);
      hideOverlay();
      showToast('SheetSage2 高精度完成 · ' + count + ' 音符 · 可继续编辑/导出', 'success');
    } catch (err) {
      console.error(err);
      hideOverlay();
      showToast('SheetSage2 识别失败：' + err.message, 'error');
    } finally {
      sheetsageRunning = false;
      updateControls();
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (/\.json$/i.test(file.name)) {
      await importProject(file);
      return;
    }
    if (/\.(mid|midi)$/i.test(file.name)) {
      if (state.recording) stopRecording();
      showOverlay('正在导入 MIDI', file.name);
      await nextPaint();
      try {
        const midi = parseMidiFile(await file.arrayBuffer());
        const sampleRate = 44100;
        const duration = Math.max(1, midi.duration + 0.1);
        const silent = new Float32Array(Math.ceil(duration * sampleRate));
        setSamples(silent, sampleRate, file.name, duration, null);
        state.bpm = normaliseBpm(midi.bpm);
        state.origin = 0;
        const stamp = Date.now().toString(36);
        state.notes = midi.notes.map((n, i) => ({
          ...n,
          id: 'm' + stamp + '_' + i,
        }));
        state.rawNotes = state.notes.map((n) => ({ ...n }));
        updateTiming();
        state.measures = Math.max(4, Math.ceil(duration / state.barDur));
        extendMeasuresToFit();
        fitPitchRange(state.notes);
        state.analysis = { mode: 'midi', bpm: state.bpm, duration, noteCount: state.notes.length };
        state.dirty = false;
        renderAll();
        chooseAutoTimbre();
        hideOverlay();
        showToast('MIDI 已导入 · ' + state.notes.length + ' 音符 · ' + formatBpm(state.bpm) + ' BPM（无原音，可编辑/导出）', 'success');
      } catch (err) {
        hideOverlay();
        console.error(err);
        showToast('MIDI 导入失败：' + err.message, 'error');
      }
      return;
    }
    if (/\.ncm$/i.test(file.name)) {
      if (state.recording) stopRecording();
      showOverlay('正在解密 NCM', '网易云加密容器 · ' + file.name);
      await nextPaint();
      try {
        const decoded = decodeNcm(await file.arrayBuffer(), (p) => {
          setOverlayProgress(p * 0.7, '解密音频流 ' + Math.round(p * 100) + '%');
        });
        const ext = decoded.format || 'mp3';
        const mime = ext === 'flac' ? 'audio/flac' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
        const outName = file.name.replace(/\.ncm$/i, '.' + ext);
        const blob = new Blob([decoded.audio], { type: mime });
        showOverlay('正在解码音频', 'NCM 已解密 · ' + outName);
        setOverlayProgress(0.82, '解码 ' + ext.toUpperCase() + '…');
        await nextPaint();
        const ctx = ensureAudioContext();
        const buffer = await ctx.decodeAudioData(decoded.audio.buffer.slice(0));
        hideOverlay();
        setAudio(buffer, outName, blob);
        showToast('NCM 已解密为 ' + ext.toUpperCase() + ' · 请选择识别方式');
        showModePrompt(outName);
      } catch (err) {
        hideOverlay();
        console.error(err);
        showToast('NCM 解密失败：' + err.message, 'error');
      }
      return;
    }
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|m4a|ogg|oga|webm|flac|aac)$/i.test(file.name)) {
      showToast('请选择音频文件（WAV / MP3 / FLAC / M4A / OGG / NCM 等）', 'error');
      return;
    }
    if (state.recording) stopRecording();
    showOverlay('正在读取音频', '解码 ' + file.name + '…');
    await nextPaint();
    try {
      const ctx = ensureAudioContext();
      const array = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(array);
      hideOverlay();
      setAudio(buffer, file.name, file);
      showToast('已载入：' + file.name + ' · 请选择识别方式');
      showModePrompt(file.name);
    } catch (err) {
      hideOverlay();
      console.error(err);
      showToast('这个音频无法解码，请换 WAV / MP3 / M4A 试试', 'error');
    }
  }

  async function loadDemo() {
    if (state.recording) stopRecording();
    showOverlay('正在准备示例', '生成一段 120 BPM 的吉他旋律…');
    await nextPaint();
    try {
      const demo = Core.generateDemo(44100);
      setSamples(demo.samples, demo.sampleRate, '示例旋律 · 清音吉他.wav', demo.duration);
      hideOverlay();
      showToast('示例已就绪 · 17 个音符 / 4 小节，正在自动识别…');
      setTimeout(analyzeCurrent, 180);
    } catch (err) {
      hideOverlay();
      console.error(err);
      showToast('示例生成失败：' + err.message, 'error');
    }
  }

  async function importProject(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.notes) || !data.notes.length) {
        throw new Error('JSON 中没有 notes 数组');
      }
      if (state.playing) stopPlayback(true);
      const meter = String(data.timeSignature || '4/4').split('/').map(Number);
      state.samples = null;
      state.sampleRate = 44100;
      state.audioBuffer = null;
      state.sourceBlob = null;
      state.sourceName = '';
      state.audioName = file.name.replace(/\.json$/i, '');
      state.wavePeaks = null;
      state.bpm = normaliseBpm(Number(data.bpm) || 120);
      state.beatsPerBar = meter[0] || 4;
      state.beatUnit = meter[1] || 4;
      state.divisions = 4;
      state.origin = Math.max(0, Math.min(...data.notes.map((n) => Number(n.start) || 0)) - 0.018);
      const stamp = Date.now().toString(36);
      state.notes = data.notes.map((n, i) => {
        const start = Math.max(0, Number(n.start) || 0);
        const duration = Math.max(0.05, Number(n.duration) || 0.1);
        const midi = Math.round(Number(n.midi) || 60);
        return {
          id: 'i' + stamp + '_' + i,
          start,
          end: start + duration,
          duration,
          midi,
          part: n.part || (midi <= 50 ? 'bass' : midi >= 72 ? 'melody' : 'harmony'),
          velocity: Math.round(Number(n.velocity) || 88),
          confidence: n.confidence != null ? Number(n.confidence) : null,
        };
      });
      state.rawNotes = state.notes.map((n) => ({ ...n }));
      state.audioDuration = Math.max(...state.notes.map((n) => n.end));
      state.measures = Math.max(4, Number(data.measures) || 4);
      state.selected.clear();
      state.playhead = 0;
      state.dirty = false;
      undoStack = [];
      redoStack = [];
      state.analysis = {
        mode: 'poly',
        bpm: state.bpm,
        confidence: 1,
        duration: state.audioDuration,
        elapsedMs: 0,
        sensitivity: 3,
        sensitivityLabel: '复音',
      };
      updateTiming();
      extendMeasuresToFit();
      fitPitchRange(state.notes);
      state.recognitionMode = 'poly';
      syncControls();
      renderAll();
      updateStatus();
      showToast(`已导入谱面 · ${state.notes.length} 音符 · ${state.measures} 小节（无原音，可编辑/导出）`, 'success');
    } catch (err) {
      console.error(err);
      showToast('导入 JSON 失败：' + err.message, 'error');
    }
  }

  function setAudio(buffer, name, sourceBlob) {
    const samples = downmix(buffer);
    setSamples(samples, buffer.sampleRate, name, buffer.duration, sourceBlob);
    state.audioBuffer = buffer;
  }

  function setSamples(samples, sampleRate, name, duration, sourceBlob) {
    if (state.playing) stopPlayback(true);
    state.samples = samples;
    state.sampleRate = sampleRate;
    state.audioName = name;
    state.sourceBlob = sourceBlob || null;
    state.cpuFallbackTried = false;
    state.sourceName = sourceBlob ? name : '';
    state.audioDuration = duration || samples.length / sampleRate;
    state.audioBuffer = null;
    playbackBuffer = null;
    playbackBufferKey = '';
    state.wavePeaks = buildWavePeaks(samples, 2600);
    state.notes = [];
    state.rawNotes = [];
    state.instrumentTracks = [];
    state.mutedParts.clear();
    state.selected.clear();
    state.measures = 4;
    state.origin = 0;
    state.playhead = 0;
    state.analysis = null;
    state.dirty = false;
    state.lowMidi = 48;
    state.highMidi = 71;
    state.scrollLeft = 0;
    if (els.gridScroll) els.gridScroll.scrollLeft = 0;
    if (els.rollBody) els.rollBody.scrollTop = 0;
    undoStack = [];
    redoStack = [];
    state.bpm = 120;
    updateTiming();
    syncControls();
    renderAll();
    if (els.instrumentHint) {
      els.instrumentHint.textContent = '按音域、包络和频谱特征，把谱子分成鼓组、贝斯、和声、主旋律；分轨后可单独静音。';
    }
    if (els.instrumentTracks) renderInstrumentTracks();
    updateRange();
  }

  function downmix(buffer) {
    const ch = buffer.numberOfChannels;
    const out = new Float32Array(buffer.length);
    for (let c = 0; c < ch; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) out[i] += data[i] / ch;
    }
    return out;
  }

  async function analyzeCurrent() {
    if (state.analyzing) return;
    if (!state.samples) {
      showToast('先打开一段音频，或点击「示例」', 'error');
      return;
    }
    if (
      state.notes.length &&
      state.dirty &&
      !window.confirm('重新识别会覆盖当前的手动修改，继续吗？')
    ) {
      return;
    }
    if (state.playing) stopPlayback(false);

    if (state.recognitionEngine === 'online') {
      await runSheetSage();
      return;
    }

    if (state.recognitionMode === 'poly') {
      await analyzePolyphonic();
      return;
    }

    state.analyzing = true;
    updateControls();
    showOverlay('正在听写旋律', '检测音高、起音与节拍…');
    await nextPaint();

    const started = performance.now();
    const preset = SENSITIVITY_PRESETS[state.sensitivity - 1] || SENSITIVITY_PRESETS[2];
    try {
      const result = Core.analyzeAudio(state.samples, state.sampleRate, {
        maxDuration: 300,
        onsetSensitivity: 0.5,
        yinThreshold: preset.yin,
        pitchConfidence: preset.confidence,
        rmsGateScale: preset.rms,
        minNoteDuration: preset.minDur,
        labelMinFrames: preset.minFrames,
      });
      applyAnalysis(result, performance.now() - started);
    } catch (err) {
      console.error(err);
      showToast('识别失败：' + err.message, 'error');
    } finally {
      state.analyzing = false;
      hideOverlay();
      updateControls();
    }
  }

  async function analyzePolyphonic() {
    const bp = window.BasicPitchTranscriber;
    if (!bp) {
      showToast('复音模型没有加载，请刷新或改用单音旋律模式', 'error');
      state.recognitionMode = 'mono';
      syncControls();
      return;
    }

    state.analyzing = true;
    updateControls();
    showOverlay('1/3 · 加载复音模型', '首次加载会慢一点，之后复用缓存…');
    setOverlayLoading('首次加载约 10–30 秒');
    await nextPaint();
    const started = performance.now();
    const modelStarted = started;
    const modelTimer = setInterval(() => {
      if (els.overlayEta) {
        els.overlayEta.textContent = '模型加载中 · 已用 ' +
          formatDuration((performance.now() - modelStarted) / 1000);
      }
    }, 500);
    const preset = POLY_PRESETS[state.sensitivity - 1] || POLY_PRESETS[2];

    try {
      await bp.ready();
      clearInterval(modelTimer);
      els.overlayTitle.textContent = '2/3 · 正在识别伴奏';
      els.overlayText.textContent = '分段检测音高、起音与和声…';
      setOverlayProgress(0, '准备分段…');
      // 长音频分段推理：Basic Pitch 一次处理 4 分钟会占用大量 WebGL 显存，
      // 还容易在最后阶段卡住。每段 30 秒、少量重叠，最后拼接音符。
      const chunkSeconds = 30;
      const overlapSeconds = 0.3;
      const frameRate = 22050 / 256;
      const totalDuration = state.samples.length / state.sampleRate;
      const chunkCount = Math.max(1, Math.ceil(totalDuration / (chunkSeconds - overlapSeconds)));
      const totalFrames = Math.ceil(totalDuration * frameRate) + 4;
      const combinedNotes = [];
      const onsetEnvelope = new Array(totalFrames).fill(0);
      let offsetSec = 0;
      let chunkIndex = 0;
      while (offsetSec < totalDuration - 0.03) {
        const startSample = Math.floor(offsetSec * state.sampleRate);
        const endSample = Math.min(
          state.samples.length,
          Math.floor((offsetSec + chunkSeconds) * state.sampleRate)
        );
        const chunk = state.samples.subarray(startSample, endSample);
        const chunkDuration = (endSample - startSample) / state.sampleRate;
        const isLast = endSample >= state.samples.length;
        const chunkResult = await bp.transcribe(
          chunk,
          state.sampleRate,
          {
            onsetThreshold: preset.onset,
            frameThreshold: preset.frame,
            minNoteLength: preset.minLength,
          },
          (progress) => {
            const ratio = Math.min(1, (chunkIndex + Core.clamp(progress, 0, 1)) / chunkCount);
            const processed = Math.min(totalDuration, offsetSec + chunkDuration * Core.clamp(progress, 0, 1));
            const elapsed = (performance.now() - started) / 1000;
            const eta = ratio > 0.02 ? Math.max(0, elapsed * (1 - ratio) / ratio) : 0;
            setOverlayProgress(ratio,
              '第 ' + (chunkIndex + 1) + ' / ' + chunkCount + ' 段 · 已处理 ' +
              formatDuration(processed) + ' / ' + formatDuration(totalDuration) +
              ' · 剩余 ' + formatDuration(eta));
            els.overlayText.textContent =
              '复音识别 ' + Math.round(ratio * 100) + '% · ' +
              formatDuration(processed) + ' / ' + formatDuration(totalDuration) +
              ' · ' + (bp.backend ? bp.backend() : 'webgl');
          }
        );

        const offsetFrame = Math.round(offsetSec * frameRate);
        for (let f = 0; f < chunkResult.onsetEnvelope.length; f++) {
          const idx = offsetFrame + f;
          if (idx >= 0 && idx < onsetEnvelope.length) {
            onsetEnvelope[idx] = Math.max(onsetEnvelope[idx], chunkResult.onsetEnvelope[f]);
          }
        }

        for (const n of chunkResult.notes) {
          // 丢弃重叠区里重复的尾部音符，只由下一段接管
          if (!isLast && n.start > chunkDuration - overlapSeconds - 0.08) continue;
          combinedNotes.push({ ...n, start: n.start + offsetSec });
        }

        chunkIndex++;
        if (isLast) break;
        offsetSec = (endSample - Math.floor(overlapSeconds * state.sampleRate)) / state.sampleRate;
        if (offsetSec <= 0) break;
      }

      els.overlayTitle.textContent = '3/3 · 整理谱面';
      setOverlayProgress(0.99, '合并 ' + combinedNotes.length + ' 个分段音符…');

      const result = {
        notes: combinedNotes,
        onsetEnvelope,
        frameRate,
        duration: totalDuration,
      };

      let raw = result.notes.filter(
        (n) =>
          Number.isFinite(n.start) &&
          Number.isFinite(n.duration) &&
          n.duration >= 0.06 &&
          n.midi >= 24 &&
          n.midi <= 108 &&
          n.amplitude >= preset.amplitude
      );
      raw.sort((a, b) => a.start - b.start || a.midi - b.midi);
      raw = mergeRawNoteFragments(raw);

      // 复音结果可能非常密；限制到最强的一批音符，避免卷帘和试听过载。
      if (raw.length > 6000) {
        raw = raw
          .slice()
          .sort((a, b) => b.amplitude - a.amplitude)
          .slice(0, 6000)
          .sort((a, b) => a.start - b.start || a.midi - b.midi);
      }

      if (!raw.length) {
        state.notes = [];
        state.rawNotes = [];
        state.measures = 4;
        state.analysis = null;
        updateTiming();
        syncControls();
        renderAll();
        showToast('复音模型没有发现音符，试试提高灵敏度或换更清晰的音频', 'error');
        return;
      }

      const amps = raw.map((n) => n.amplitude);
      let lo = Core.percentile(amps, 0.1);
      let hi = Core.percentile(amps, 0.9);
      if (!(hi > lo + 0.01)) {
        lo = Math.min(...amps) - 0.01;
        hi = Math.max(...amps) + 0.01;
      }

      const stamp = Date.now().toString(36);
      state.rawNotes = raw.map((n, index) => ({
        id: 'p' + stamp + '_' + index,
        start: Math.max(0, n.start),
        end: Math.max(0, n.start + n.duration),
        duration: Math.max(0.06, n.duration),
        midi: Math.round(n.midi),
        part: n.midi <= 50 ? 'bass' : n.midi >= 72 ? 'high' : 'mid',
        velocity: Math.round(Core.clamp(44 + ((n.amplitude - lo) / (hi - lo)) * 76, 38, 122)),
        confidence: n.amplitude,
      }));
      state.dirty = false;
      state.selected.clear();
      state.playhead = 0;
      undoStack = [];
      redoStack = [];

      const tempo = Core.estimateTempo(
        result.onsetEnvelope,
        result.frameRate,
        result.duration
      );
      state.bpm = normaliseBpm(tempo.bpm || 120);
      state.origin = Math.max(0, state.rawNotes[0].start - 0.018);
      state.analysis = {
        mode: 'poly',
        bpm: state.bpm,
        confidence: tempo.confidence || 0,
        duration: result.duration,
        onsetCount: 0,
        elapsedMs: performance.now() - started,
        sensitivity: 3,
        sensitivityLabel: '复音',
      };

      reflow({ force: true, push: false });
      fitPitchRange(state.notes);
      state.dirty = false;
      state.scrollLeft = 0;
      if (els.gridScroll) els.gridScroll.scrollLeft = 0;
      syncControls();
      renderAll();
      chooseAutoTimbre();

      showToast(
        `复音识别完成 · ${state.notes.length} 音符 · ${formatBpm(state.bpm)} BPM · ${state.measures} 小节 · ${(performance.now() - started) / 1000 | 0}s`,
        'success'
      );
    } catch (err) {
      if (!state.cpuFallbackTried && bp.useCpu && /shader|webgl|fragment/i.test(String(err && err.message))) {
        state.cpuFallbackTried = true;
        try {
          await bp.useCpu();
          try { localStorage.setItem('ms_force_cpu', '1'); } catch (e) {}
          showToast('当前显卡不支持 WebGL 着色器，已切换 CPU 兼容模式并重试', 'info');
          setTimeout(analyzeCurrent, 350);
          return;
        } catch (fallbackErr) {
          console.error('CPU fallback failed', fallbackErr);
        }
      }
      console.error(err);
      showToast('复音识别失败：' + err.message, 'error');
    } finally {
      clearInterval(modelTimer);
      state.analyzing = false;
      hideOverlay();
      updateControls();
    }
  }

  function applyAnalysis(result, elapsedMs) {
    if (!result) return;

    state.analysis = {
      bpm: result.bpm,
      confidence: result.confidence,
      duration: result.duration,
      onsetCount: result.onsetPeaks.length,
      elapsedMs,
      sensitivity: state.sensitivity,
      sensitivityLabel: (SENSITIVITY_PRESETS[state.sensitivity - 1] || {}).label,
    };
    const stamp = Date.now().toString(36);
    state.rawNotes = result.notes.map((n, index) => ({
      ...n,
      id: 'r' + stamp + '_' + index,
    }));
    state.bpm = normaliseBpm(result.bpm);
    state.origin = result.beatPhase || (state.rawNotes[0] && state.rawNotes[0].start) || 0;
    state.dirty = false;
    state.selected.clear();
    state.playhead = 0;
    undoStack = [];
    redoStack = [];

    if (!state.rawNotes.length) {
      state.notes = [];
      state.measures = 4;
      updateTiming();
      syncControls();
      renderAll();
      showToast('没有发现清晰的单音旋律，试试更干净的人声 / 吉他录音', 'error');
      return;
    }

    reflow({ force: true, push: false });
    fitPitchRange(state.notes);
    state.dirty = false;
    state.scrollLeft = 0;
    if (els.gridScroll) els.gridScroll.scrollLeft = 0;
    syncControls();
    renderAll();
    chooseAutoTimbre();

    const measureText = state.measures + ' 小节';
    const bpmText = formatBpm(state.bpm);
    const notesPerMinute = state.notes.length / Math.max(1, result.duration / 60);
    const sparseHint =
      state.notes.length > 0 && notesPerMinute < 12
        ? ' · 只找到少量单音片段，完整混音请先分离人声/主旋律'
        : '';
    showToast(
      `识别完成 · ${state.notes.length} 个音符 · ${bpmText} BPM · ${measureText} · ${(elapsedMs / 1000).toFixed(2)}s${sparseHint}`,
      state.notes.length ? (sparseHint ? 'info' : 'success') : 'error'
    );
  }

  function mergeRawNoteFragments(notes) {
    const byPitch = new Map();
    for (const n of notes) {
      const key = n.midi;
      if (!byPitch.has(key)) byPitch.set(key, []);
      byPitch.get(key).push(n);
    }
    const merged = [];
    for (const list of byPitch.values()) {
      list.sort((a, b) => a.start - b.start);
      let cur = null;
      for (const n of list) {
        const nEnd = n.start + (n.duration || 0);
        const nDur = n.duration || 0;
        if (cur && n.start <= cur.end + 0.02 &&
            ((cur.duration || 0) < 0.18 || nDur < 0.18)) {
          cur.end = Math.max(cur.end, nEnd);
          cur.duration = cur.end - cur.start;
          cur.amplitude = Math.max(cur.amplitude || 0, n.amplitude || 0);
        } else {
          cur = { ...n, end: nEnd };
          merged.push(cur);
        }
      }
    }
    merged.sort((a, b) => a.start - b.start || a.midi - b.midi);
    return merged;
  }

  function normaliseBpm(bpm) {
    if (!Number.isFinite(bpm) || bpm <= 0) return 120;
    const rounded = Math.round(bpm);
    if (Math.abs(bpm - rounded) < 0.6) return rounded;
    return Math.round(bpm * 10) / 10;
  }

  /* ====================================================================== */
  /* 分小节 / 量化                                                          */
  /* ====================================================================== */

  function updateTiming() {
    state.beatDur = (60 / state.bpm) * (4 / state.beatUnit);
    state.barDur = state.beatDur * state.beatsPerBar;
    state.step = state.beatDur / state.divisions;
  }

  function reflow(options) {
    const opts = options || {};
    if (!state.rawNotes.length) {
      updateTiming();
      recomputeManualMeasures();
      renderAll();
      return true;
    }

    if (state.dirty && !opts.force) {
      const ok = window.confirm('重新分小节会覆盖你对音符的手动修改，继续吗？');
      if (!ok) return false;
    }

    if (opts.push !== false && state.notes.length) pushUndo();

    updateTiming();
    const q = Core.quantizeNotes(state.rawNotes, {
      bpm: state.bpm,
      beatsPerBar: state.beatsPerBar,
      beatUnit: state.beatUnit,
      divisionsPerBeat: state.divisions,
      origin: state.origin,
      quantize: state.quantize,
    });

    state.notes = q.notes.map((n, i) => ({
      ...n,
      id: n.id || 'q' + i,
    }));
    state.beatDur = q.beatDuration;
    state.barDur = q.barDuration;
    state.step = q.step;
    state.origin = q.origin;
    state.measures = Math.max(4, q.measures);
    extendMeasuresToFit();
    fitPitchRange(state.notes);
    state.dirty = false;

    const ids = new Set(state.notes.map((n) => n.id));
    Array.from(state.selected).forEach((id) => {
      if (!ids.has(id)) state.selected.delete(id);
    });
    state.playhead = Math.min(state.playhead, getTimelineEnd() || state.playhead);

    syncControls();
    renderAll();
    return true;
  }

  function recomputeManualMeasures() {
    if (!state.notes.length) {
      state.measures = Math.max(4, state.measures);
      return;
    }
    let maxM = 4;
    for (const n of state.notes) {
      const m = Math.floor(Math.max(0, n.start - state.origin) / state.barDur) + 1;
      maxM = Math.max(maxM, m);
    }
    state.measures = Math.min(256, Math.max(state.measures, maxM));
  }

  function extendMeasuresToFit() {
    let maxM = 4;
    for (const n of state.notes) {
      const pos = Math.max(0, n.start + n.duration - state.origin);
      maxM = Math.max(maxM, Math.ceil(pos / state.barDur));
    }
    if (isFinite(maxM)) state.measures = Math.min(256, Math.max(state.measures, maxM));
  }

  function fitPitchRange(notes) {
    let lo = 48;
    let hi = 71;
    let minNote = 48;
    let maxNote = 71;
    if (notes && notes.length) {
      minNote = 127;
      maxNote = 0;
      for (const n of notes) {
        lo = Math.min(lo, n.midi);
        hi = Math.max(hi, n.midi);
        minNote = Math.min(minNote, n.midi);
        maxNote = Math.max(maxNote, n.midi);
      }
    }

    // 保证至少显示 24 个半音（C3–B4）。
    if (hi - lo + 1 < 24) {
      const missing = 24 - (hi - lo + 1);
      hi += Math.ceil(missing / 2);
      lo -= Math.floor(missing / 2);
    }
    // 音域特别宽时不再截掉两端的音，只把范围包住所有音符。
    if (hi - lo + 1 > 40) {
      lo = Math.max(0, minNote - 1);
      hi = Math.min(127, maxNote + 1);
    }
    state.lowMidi = Core.clamp(lo, 0, 100);
    state.highMidi = Core.clamp(hi, state.lowMidi + 23, 127);
  }

  /* ====================================================================== */
  /* 编辑操作                                                               */
  /* ====================================================================== */

  function setTool(tool) {
    state.tool = tool;
    state.hover = null;
    updateControls();
    updateCursor();
    renderRoll();
  }

  function selectOnly(id, additive) {
    if (additive) {
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
    } else {
      state.selected = new Set([id]);
    }
  }

  function updateCursor() {
    if (!els.rollCanvas) return;
    if (state.tool === 'pencil') els.rollCanvas.style.cursor = 'crosshair';
    else if (state.tool === 'eraser') els.rollCanvas.style.cursor = 'cell';
    else els.rollCanvas.style.cursor = 'default';
  }

  function applyLength(length) {
    if (!Number.isFinite(length)) return;
    state.noteLength = length;
    const mult = state.dotted ? 1.5 : 1;
    if (state.selected.size) {
      const selected = getSelectedNotes();
      if (!selected.length) return;
      pushUndo();
      for (const n of selected) {
        n.end = n.start + length * mult * state.beatDur;
        n.duration = n.end - n.start;
      }
      state.dirty = true;
      extendMeasuresToFit();
      renderAll();
    }
    updateControls();
  }

  function toggleDotted() {
    state.dotted = !state.dotted;
    if (state.selected.size) {
      const selected = getSelectedNotes();
      if (selected.length) {
        pushUndo();
        for (const n of selected) {
          n.end = n.start + state.noteLength * (state.dotted ? 1.5 : 1) * state.beatDur;
          n.duration = n.end - n.start;
        }
        state.dirty = true;
        extendMeasuresToFit();
        renderAll();
      }
    }
    updateControls();
  }

  function applyVelocity(velocity) {
    state.velocity = velocity;
    if (state.selected.size) {
      const selected = getSelectedNotes();
      if (!selected.length) return;
      pushUndo();
      for (const n of selected) n.velocity = velocity;
      state.dirty = true;
      renderAll();
    }
    updateControls();
  }

  function onFineAnalyze() {
    state.sensitivity = 4;
    state.divisions = 8;
    syncControls();
    if (state.samples) {
      analyzeCurrent();
    } else if (state.notes.length) {
      reflow({ force: true, push: true });
      showToast('已用 1/32 网格重新量化；要更细的起音请重新载入音频识别', 'success');
    }
  }

  function simplifyPoly() {
    if (!state.notes.length) return;
    if (!window.confirm('精简会删除置信度低的音符，可能把原曲的弱伴奏一起删掉。继续吗？')) {
      return;
    }
    const before = state.notes.length;
    const kept = state.notes.filter(
      (n) =>
        (n.confidence == null || n.confidence >= 0.5) &&
        n.midi >= 28 &&
        n.duration >= 0.1
    );
    if (!kept.length || kept.length === before) {
      showToast(kept.length ? '当前已经是精简结果' : '没有可保留的音符');
      return;
    }
    pushUndo();
    state.notes = kept;
    state.selected.clear();
    state.dirty = true;
    state.measures = 4;
    extendMeasuresToFit();
    // 重新按当前 BPM/拍号计算小节，不改变音符位置
    state.measures = Math.max(4, state.measures);
    fitPitchRange(state.notes);
    renderAll();
    showToast(`复音精简：${before} → ${kept.length} 个音符（保留置信度 ≥ 0.5）`, 'success');
  }

  function lowPassBassSamples(samples, sampleRate) {
    const out = new Float32Array(samples.length);
    const cutoff = 240;
    const w0 = 2 * Math.PI * cutoff / sampleRate;
    const cosw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * 0.7071);
    const a0 = 1 + alpha;
    const b0 = (1 - cosw) / 2 / a0;
    const b1 = (1 - cosw) / a0;
    const b2 = b0;
    const a1 = -2 * cosw / a0;
    const a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      out[i] = y;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
    }
    return out;
  }

  function bassAttackAt(time) {
    const samples = state.samples;
    const sr = state.sampleRate;
    if (!samples || !sr) return false;
    const center = Math.max(0, Math.floor(time * sr));
    const win = Math.floor(0.035 * sr);
    const before = Math.max(1, center - win);
    const afterEnd = Math.min(samples.length, center + win);
    let e1 = 0, e2 = 0, n1 = 0, n2 = 0;
    for (let i = before; i < center; i++) { e1 += samples[i] * samples[i]; n1++; }
    for (let i = center; i < afterEnd; i++) { e2 += samples[i] * samples[i]; n2++; }
    const r1 = Math.sqrt(e1 / Math.max(1, n1));
    const r2 = Math.sqrt(e2 / Math.max(1, n2));
    return r2 > r1 * 1.35 + 1e-5;
  }

  let bassOnsetTimes = [];

  function detectBassOnsets() {
    bassOnsetTimes = [];
    if (!state.samples || !state.sampleRate || !state.samples.length) return;
    const filtered = lowPassBassSamples(state.samples, state.sampleRate);
    const result = Core.analyzeAudio(filtered, state.sampleRate, {
      frameSize: 2048,
      hop: 512,
      fftSize: 4096,
      minFreq: 38,
      maxFreq: 360,
      yinThreshold: 0.22,
      onsetSensitivity: 0.7,
      pitchConfidence: 0.45,
      rmsGateScale: 0.5,
      minNoteDuration: 0.09,
      labelMinFrames: 3,
      maxDuration: state.audioDuration || 300,
    });
    bassOnsetTimes = (result.onsetPeaks || []).map((p) => p.time);
  }

  function hasBassOnsetNear(time) {
    return bassOnsetTimes.some((t) => Math.abs(t - time) <= 0.07);
  }

  function mergeBassOverlaps(notes) {
    const low = notes.filter((n) => n.midi <= 50);
    const rest = notes.filter((n) => n.midi > 50);
    const byPitch = new Map();
    const allStarts = low.map((n) => n.start).sort((a, b) => a - b);
    for (const n of low) {
      if (!byPitch.has(n.midi)) byPitch.set(n.midi, []);
      byPitch.get(n.midi).push(n);
    }
    const merged = [];
    for (const list of byPitch.values()) {
      list.sort((a, b) => a.start - b.start);
      let cur = null;
      let lastAttack = -1;
      for (const n of list) {
        const attack = bassAttackAt(n.start);
        if (cur && n.start <= cur.end + 0.02) {
          cur.end = Math.max(cur.end, n.end);
          cur.duration = cur.end - cur.start;
          cur.velocity = Math.max(cur.velocity || 0, n.velocity || 0);
          cur.confidence = Math.max(cur.confidence || 0, n.confidence || 0);
        } else {
          cur = { ...n, end: n.end };
          merged.push(cur);
          lastAttack = attack ? n.start : lastAttack;
        }
      }
    }
    const out = [];
    for (const n of merged) {
      if (n.duration > 1.3) {
        const candidates = allStarts.filter((t) => t > n.start + 0.4 && t < n.end - 0.1);
        if (candidates.length) {
          const cut = candidates[candidates.length - 1];
          out.push({ ...n, end: cut, duration: cut - n.start });
          out.push({ ...n, start: cut, duration: n.end - cut });
          continue;
        }
      }
      out.push(n);
    }
    return rest.concat(out);
  }

  function extractBassNotes() {
    if (!state.samples || !state.sampleRate || !state.samples.length) return [];
    if (!Core || typeof Core.analyzeAudio !== 'function') return [];
    const filtered = lowPassBassSamples(state.samples, state.sampleRate);
    const result = Core.analyzeAudio(filtered, state.sampleRate, {
      frameSize: 3072,
      hop: 512,
      fftSize: 4096,
      minFreq: 38,
      maxFreq: 380,
      yinThreshold: 0.2,
      onsetSensitivity: 0.42,
      pitchConfidence: 0.4,
      rmsGateScale: 0.58,
      minNoteDuration: 0.1,
      labelMinFrames: 4,
      maxDuration: state.audioDuration || 300,
    });
    return (result.notes || [])
      .filter((n) => n.midi >= 28 && n.midi <= 52)
      .map((n, i) => ({
        id: 'yb' + Date.now().toString(36) + '_' + i,
        start: n.start,
        end: n.end,
        duration: n.duration,
        midi: n.midi,
        part: 'bass',
        instrument: '贝斯',
        velocity: Math.round(Core.clamp(n.velocity || 92, 40, 120)),
        confidence: n.confidence || 0.7,
      }));
  }

  function noteZeroCrossingRate(n) {
    const samples = state.samples;
    if (!samples || !state.sampleRate) return 0;
    const start = Math.max(0, Math.floor(n.start * state.sampleRate));
    const end = Math.min(samples.length, Math.floor(Math.min(n.end, n.start + 0.16) * state.sampleRate));
    const len = end - start;
    if (len < 8) return 0;
    const stride = Math.max(1, Math.floor(len / 4096));
    let crossings = 0;
    let count = 0;
    let prev = samples[start] >= 0;
    for (let i = start + stride; i < end; i += stride) {
      const cur = samples[i] >= 0;
      if (cur !== prev) crossings++;
      prev = cur;
      count++;
    }
    return count ? crossings / count : 0;
  }

  function renderInstrumentTracks() {
    const box = els.instrumentTracks;
    if (!box) return;
    box.replaceChildren();
    const tracks = state.instrumentTracks || [];
    for (const track of tracks) {
      const row = document.createElement('div');
      row.className = 'instrument-track' + (state.mutedParts.has(track.key) ? ' muted' : '');
      row.title = '点击静音 / 恢复 ' + track.label;
      const dot = document.createElement('i');
      dot.style.background = track.color;
      const name = document.createElement('b');
      name.textContent = track.label;
      const count = document.createElement('em');
      count.textContent = track.count + ' 音';
      row.append(dot, name, count);
      row.addEventListener('click', () => {
        if (state.mutedParts.has(track.key)) state.mutedParts.delete(track.key);
        else state.mutedParts.add(track.key);
        renderInstrumentTracks();
        renderAll();
      });
      box.appendChild(row);
    }
    document.querySelectorAll('.part-toggle').forEach((el) => {
      el.classList.toggle('muted', state.mutedParts.has(el.dataset.part));
    });
  }

  function recognizeInstruments() {
    if (!state.notes.length) {
      showToast('先载入音频并识别，或加载示例后再分轨');
      return;
    }
    const drumTimbre = !!TIMBRES[state.timbre].drum;
    pushUndo();
    // 分轨时忽略过短的识别碎片，避免把起音噪声当成新乐器音符
    const tooShort = new Set();
    for (const n of state.notes) {
      if ((n.duration || 0) < 0.18 && (n.confidence == null || n.confidence < 0.85)) {
        tooShort.add(n.id);
      }
    }
    // 抑制 BasicPitch 常见的同起音八度泛音：只删除置信度明显更低、时值接近的高八度影子音
    const octaveDrops = new Set();
    for (const n of state.notes) {
      if (n.confidence == null) continue;
      for (const m of state.notes) {
        if (m === n || m.confidence == null) continue;
        if (n.midi - m.midi !== 12) continue;
        if (Math.abs(n.start - m.start) > 0.05) continue;
        if (n.duration > m.duration * 1.4) continue;
        if (n.confidence < m.confidence - 0.08) {
          octaveDrops.add(n.id);
          break;
        }
      }
    }
    const cleanup = new Set([...tooShort, ...octaveDrops]);
    if (cleanup.size && window.confirm(
      '分轨时检测到 ' + cleanup.size + ' 个疑似碎片音 / 八度泛音。\n' +
      '清理后谱面会更干净，但可能删掉真实的短音或八度叠奏。\n' +
      '要清理这些音符吗？'
    )) {
      state.notes = state.notes.filter((n) => !cleanup.has(n.id));
      for (const id of cleanup) state.selected.delete(id);
    }

    // 低音区同音高的重叠段合并成一个持续音，避免贝斯被切成两下
    detectBassOnsets();
    state.notes = mergeBassOverlaps(state.notes);
    const groups = { drums: [], bass: [], harmony: [], melody: [] };
    const zcrCache = new Map();

    for (const n of state.notes) {
      const dur = Math.max(0.02, n.duration || (n.end - n.start));
      let zcr = zcrCache.get(n.id);
      if (zcr == null) {
        zcr = noteZeroCrossingRate(n);
        zcrCache.set(n.id, zcr);
      }
      let part;
      if (n.part === 'bass') {
        part = 'bass';
      } else if (drumTimbre && n.midi >= 35 && n.midi <= 81) {
        part = 'drums';
      } else if (n.midi <= 59 && dur <= 0.22 && zcr > 0.1) {
        part = 'drums';
      } else if (n.midi <= 50) {
        part = 'bass';
      } else if (n.midi >= 67 && dur >= 0.14) {
        part = 'melody';
      } else {
        part = 'harmony';
      }
      n.part = part;
      groups[part].push({ note: n, zcr, dur });
    }

    const avg = (arr, pick) => arr.length ? arr.reduce((s, x) => s + pick(x), 0) / arr.length : 0;
    const harmonyDur = avg(groups.harmony, (x) => x.dur);
    const harmonyZcr = avg(groups.harmony, (x) => x.zcr);
    const harmonyLabel = harmonyDur >= 0.45
      ? '和声 · 弦乐'
      : harmonyZcr >= 0.08 ? '和声 · 吉他' : '和声 · 钢琴';
    const labels = {
      drums: '鼓组',
      bass: '贝斯',
      harmony: harmonyLabel,
      melody: '主旋律',
    };
    const colors = {
      drums: '#c56b4b',
      bass: '#7e9ca1',
      harmony: '#c3a95f',
      melody: '#8fa26a',
    };
    for (const key of Object.keys(groups)) {
      for (const item of groups[key]) item.note.instrument = labels[key];
    }

    state.mutedParts.clear();
    state.instrumentTracks = ['drums', 'bass', 'harmony', 'melody']
      .filter((key) => groups[key].length)
      .map((key) => ({ key, label: labels[key], color: colors[key], count: groups[key].length }));
    state.dirty = true;
    renderInstrumentTracks();
    renderAll();
    const summary = state.instrumentTracks.map((t) => t.label + ' ' + t.count).join(' · ');
    if (els.instrumentHint) {
      els.instrumentHint.textContent = summary + '。点击各轨可单独静音；MIDI 导出会按这些分轨写。';
    }
    showToast('乐器识别完成：' + summary, 'success');
  }

  function transposeSelected(delta) {
    const selected = getSelectedNotes();
    if (!selected.length) {
      showToast('先选中一些音符');
      return;
    }
    pushUndo();
    for (const n of selected) n.midi = Core.clamp(n.midi + delta, 12, 108);
    fitPitchRange(state.notes);
    state.dirty = true;
    renderAll();
  }

  function deleteSelected() {
    if (!state.selected.size) return;
    pushUndo();
    state.notes = state.notes.filter((n) => !state.selected.has(n.id));
    state.selected.clear();
    state.dirty = true;
    renderAll();
  }

  function copySelection() {
    const selected = getSelectedNotes();
    if (!selected.length) {
      showToast('先用「选择」工具框选要复制的音符');
      return;
    }
    const minStart = Math.min(...selected.map((n) => n.start));
    state.clipboard = selected.map((n) => ({
      offset: n.start - minStart,
      duration: n.duration,
      midi: n.midi,
      velocity: n.velocity,
    }));
    showToast(`已复制 ${state.clipboard.length} 个音符，按 Ctrl+V 粘贴到光标处`);
  }

  function pasteClipboard() {
    if (!state.clipboard.length) {
      showToast('剪贴板里还没有音符');
      return;
    }
    pushUndo();
    const anchor = Math.max(
      state.origin,
      state.playhead > 0 ? state.playhead : state.origin
    );
    const snapped = state.origin + Math.round((anchor - state.origin) / state.step) * state.step;
    const stamp = Date.now().toString(36);
    const fresh = state.clipboard.map((c, i) => ({
      id: 'p' + stamp + '_' + i,
      start: snapped + c.offset,
      end: snapped + c.offset + c.duration,
      duration: c.duration,
      midi: c.midi,
      velocity: c.velocity,
      confidence: 1,
    }));
    state.notes = state.notes.concat(fresh);
    state.selected = new Set(fresh.map((n) => n.id));
    state.dirty = true;
    extendMeasuresToFit();
    fitPitchRange(state.notes);
    renderAll();
    showToast(`已粘贴 ${fresh.length} 个音符`);
  }

  function selectAll() {
    state.selected = new Set(state.notes.map((n) => n.id));
    renderAll();
  }

  function getSelectedNotes() {
    return state.notes.filter((n) => state.selected.has(n.id));
  }

  function pushUndo() {
    undoStack.push(captureState());
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
    updateControls();
  }

  function captureState() {
    return {
      notes: state.notes.map((n) => ({ ...n })),
      measures: state.measures,
      lowMidi: state.lowMidi,
      highMidi: state.highMidi,
      selected: Array.from(state.selected),
      playhead: state.playhead,
      bpm: state.bpm,
      beatsPerBar: state.beatsPerBar,
      beatUnit: state.beatUnit,
      divisions: state.divisions,
      quantize: state.quantize,
      origin: state.origin,
      instrumentTracks: (state.instrumentTracks || []).map((t) => ({ ...t })),
      mutedParts: Array.from(state.mutedParts),
    };
  }

  function restoreState(s) {
    state.notes = s.notes.map((n) => ({ ...n }));
    state.measures = s.measures;
    state.lowMidi = s.lowMidi;
    state.highMidi = s.highMidi;
    state.selected = new Set(s.selected || []);
    state.playhead = s.playhead || 0;
    if (s.bpm != null) {
      state.bpm = s.bpm;
      state.beatsPerBar = s.beatsPerBar;
      state.beatUnit = s.beatUnit;
      state.divisions = s.divisions;
      state.quantize = s.quantize;
      state.origin = s.origin;
      updateTiming();
      syncControls();
    }
    state.dirty = true;
    if (s.instrumentTracks) state.instrumentTracks = s.instrumentTracks.map((t) => ({ ...t }));
    if (s.mutedParts) state.mutedParts = new Set(s.mutedParts);
    if (els.instrumentTracks) renderInstrumentTracks();
    if (els.instrumentHint) {
      if (state.instrumentTracks.length) {
        els.instrumentHint.textContent = state.instrumentTracks
          .map((t) => t.label + ' ' + t.count)
          .join(' · ') + '。点击各轨可单独静音；MIDI 导出会按这些分轨写。';
      } else {
        els.instrumentHint.textContent = '按音域、包络和频谱特征，把谱子分成鼓组、贝斯、和声、主旋律；分轨后可单独静音。';
      }
    }
    renderAll();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(captureState());
    const s = undoStack.pop();
    restoreState(s);
    updateControls();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(captureState());
    const s = redoStack.pop();
    restoreState(s);
    updateControls();
  }

  /* ====================================================================== */
  /* 画布交互                                                               */
  /* ====================================================================== */

  function pointFromEvent(e) {
    const rect = els.rollCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function pointToGrid(p) {
    const timelineX = p.x + (els.gridScroll.scrollLeft || 0);
    const col = Math.floor(timelineX / state.cellW);
    const row = Math.floor((p.y - state.headerH) / state.rowH);
    const totalCols = state.measures * state.beatsPerBar * state.divisions;
    return {
      col: Core.clamp(col, 0, totalCols - 1),
      row,
      midi: state.highMidi - row,
      inHeader: p.y < state.headerH,
      inGrid: row >= 0 && row < state.highMidi - state.lowMidi + 1 && col >= 0 && col < totalCols,
    };
  }

  function timeToX(t) {
    return ((t - state.origin) / state.step) * state.cellW;
  }

  function xToTime(x) {
    return state.origin + (x / state.cellW) * state.step;
  }

  function noteRect(n) {
    const x = timeToX(n.start);
    const y = state.headerH + (state.highMidi - n.midi) * state.rowH;
    const w = Math.max(5, (n.duration / state.step) * state.cellW - 1);
    const h = Math.max(5, state.rowH - 2);
    return { x, y, w, h };
  }

  function noteAtPoint(p) {
    const px = p.x + (els.gridScroll.scrollLeft || 0);
    for (let i = state.notes.length - 1; i >= 0; i--) {
      const n = state.notes[i];
      const r = noteRect(n);
      if (px >= r.x - 2 && px <= r.x + r.w + 3 && p.y >= r.y - 1 && p.y <= r.y + r.h + 1) {
        return n;
      }
    }
    return null;
  }

  function previewNote(note) {
    if (!note) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const when = ctx.currentTime + 0.02;
    makeVoice(note, when, 2.4, false);
    const label = TIMBRES[state.timbre].drum ? rowLabel(note.midi) : Core.midiToName(note.midi);
    showToast('试音：' + label + ' · ' + TIMBRES[state.timbre].label + ' · 自然衰减');
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const p = pointFromEvent(e);
    const g = pointToGrid(p);
    if (g.inHeader) {
      const t = state.origin + Math.max(0, g.col) * state.step;
      if (state.playing) stopPlayback(false);
      setPlayhead(t);
      return;
    }
    if (!g.inGrid) return;

    els.rollCanvas.setPointerCapture(e.pointerId);
    const hit = noteAtPoint(p);

    if (hit && e.altKey) {
      previewNote(hit);
      return;
    }

    if (state.tool === 'pencil') {
      if (hit) {
        selectOnly(hit.id, e.shiftKey);
        dragMoved = false;
        state.drag = { type: 'move', startX: p.x, startY: p.y, originals: snapshotSelected(), moved: false };
        return;
      }
      pushUndo();
      const mult = state.dotted ? 1.5 : 1;
      const note = {
        id: uid('m'),
        start: state.origin + g.col * state.step,
        end: state.origin + g.col * state.step + state.noteLength * mult * state.beatDur,
        duration: state.noteLength * mult * state.beatDur,
        midi: g.midi,
        velocity: state.velocity,
        confidence: 1,
      };
      state.notes.push(note);
      state.selected = new Set([note.id]);
      state.dirty = true;
      extendMeasuresToFit();
      state.drag = {
        type: 'create',
        noteId: note.id,
        startCol: g.col,
        moved: false,
      };
      renderAll();
      return;
    }

    if (state.tool === 'eraser') {
      if (!hit) return;
      pushUndo();
      state.notes = state.notes.filter((n) => n.id !== hit.id);
      state.selected.delete(hit.id);
      state.dirty = true;
      state.drag = { type: 'erase', moved: true };
      renderAll();
      return;
    }

    // 选择工具
    if (hit) {
      if (e.shiftKey) {
        if (state.selected.has(hit.id)) state.selected.delete(hit.id);
        else state.selected.add(hit.id);
      } else if (!state.selected.has(hit.id)) {
        state.selected = new Set([hit.id]);
      }
      const r = noteRect(hit);
      const scrollLeft = els.gridScroll.scrollLeft || 0;
      const onEdge = p.x + scrollLeft >= r.x + r.w - 6;
      dragMoved = false;
      state.drag = {
        type: onEdge ? 'resize' : 'move',
        startX: p.x,
        startY: p.y,
        originals: snapshotSelected(),
        edgeNoteId: hit.id,
        moved: false,
      };
      updateControls();
      renderAll();
    } else {
      if (!e.shiftKey) state.selected.clear();
      const scrollLeft = els.gridScroll.scrollLeft || 0;
      state.drag = {
        type: 'marquee',
        startX: p.x,
        startY: p.y,
        startTimelineX: p.x + scrollLeft,
        currentX: p.x,
        currentY: p.y,
        additive: e.shiftKey,
        baseline: new Set(state.selected),
      };
      state.marquee = {
        x1: p.x + scrollLeft,
        y1: p.y,
        x2: p.x + scrollLeft,
        y2: p.y,
      };
      updateControls();
      renderAll();
    }
  }

  function snapshotSelected() {
    return getSelectedNotes().map((n) => ({
      id: n.id,
      start: n.start,
      end: n.end,
      duration: n.duration,
      midi: n.midi,
      velocity: n.velocity,
    }));
  }

  function onPointerMove(e) {
    const p = pointFromEvent(e);
    const g = pointToGrid(p);
    state.hover = g.inGrid ? { col: g.col, midi: g.midi } : null;
    const drag = state.drag;

    if (!drag) {
      if (state.tool === 'pencil') renderRoll();
      return;
    }

    if (drag.type === 'create') {
      const note = state.notes.find((n) => n.id === drag.noteId);
      if (note) {
        const col = Math.max(drag.startCol, Math.min(g.col, drag.startCol + 64));
        const newDur = Math.max(state.step, (col - drag.startCol + 1) * state.step);
        note.duration = newDur;
        note.end = note.start + newDur;
        drag.moved = true;
        extendMeasuresToFit();
      }
      renderAll();
      return;
    }

    if (drag.type === 'erase') {
      const hit = noteAtPoint(p);
      if (hit) {
        state.notes = state.notes.filter((n) => n.id !== hit.id);
        state.selected.delete(hit.id);
        state.dirty = true;
        renderAll();
      }
      return;
    }

    if (drag.type === 'marquee') {
      const scrollLeft = els.gridScroll.scrollLeft || 0;
      const timelineX = p.x + scrollLeft;
      drag.currentX = timelineX;
      drag.currentY = p.y;
      state.marquee = {
        x1: Math.min(drag.startTimelineX, timelineX),
        y1: Math.min(drag.startY, p.y),
        x2: Math.max(drag.startTimelineX, timelineX),
        y2: Math.max(drag.startY, p.y),
      };
      renderRoll();
      return;
    }

    if (drag.type === 'move' || drag.type === 'resize') {
      const deltaCol = Math.round((p.x - drag.startX) / state.cellW);
      const deltaRow = Math.round((p.y - drag.startY) / state.rowH);
      if (!drag.moved && (deltaCol !== 0 || deltaRow !== 0)) {
        pushUndo();
        drag.moved = true;
      }
      if (!drag.moved) return;

      if (drag.type === 'move') {
        const minStart = Math.min(...drag.originals.map((n) => n.start));
        const minDelta = Math.ceil((state.origin - minStart) / state.step) * state.step;
        const safeDelta = Math.max(deltaCol * state.step, minDelta);
        for (const orig of drag.originals) {
          const note = state.notes.find((n) => n.id === orig.id);
          if (!note) continue;
          note.start = orig.start + safeDelta;
          note.end = orig.end + safeDelta;
          note.duration = note.end - note.start;
          note.midi = Core.clamp(orig.midi + deltaRow, 12, 108);
        }
        fitPitchRange(state.notes);
        state.dirty = true;
        extendMeasuresToFit();
      } else {
        const orig = drag.originals.find((n) => n.id === drag.edgeNoteId) || drag.originals[0];
        const note = state.notes.find((n) => n.id === drag.edgeNoteId);
        if (note && orig) {
          const newDur = Math.max(state.step, orig.duration + deltaCol * state.step);
          note.end = note.start + newDur;
          note.duration = newDur;
          state.dirty = true;
          extendMeasuresToFit();
        }
      }
      renderAll();
    }
  }

  function onPointerUp(e) {
    const drag = state.drag;
    if (!drag) return;
    if (drag.type === 'marquee' && state.marquee) {
      const m = state.marquee;
      const selected = drag.additive ? new Set(drag.baseline) : new Set();
      for (const n of state.notes) {
        const r = noteRect(n);
        if (r.x + r.w >= m.x1 && r.x <= m.x2 && r.y + r.h >= m.y1 && r.y <= m.y2) {
          selected.add(n.id);
        }
      }
      state.selected = selected;
    } else if (drag.type === 'move' || drag.type === 'resize' || drag.type === 'create') {
      if (drag.type === 'create') {
        // 单击写入时使用当前音长，拖动时已实时拉伸
        const note = state.notes.find((n) => n.id === drag.noteId);
        if (note && note.duration < state.step * 0.5) {
          note.end = note.start + state.noteLength * (state.dotted ? 1.5 : 1) * state.beatDur;
          note.duration = note.end - note.start;
        }
      }
      if (drag.moved) state.dirty = true;
    }

    state.drag = null;
    state.marquee = null;
    dragMoved = false;
    try {
      els.rollCanvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
    renderAll();
    updateControls();
  }

  function onPointerLeave() {
    if (!state.drag) {
      state.hover = null;
      renderRoll();
    }
  }

  function onContextMenu(e) {
    const p = pointFromEvent(e);
    const hit = noteAtPoint(p);
    if (hit) {
      e.preventDefault();
      pushUndo();
      state.notes = state.notes.filter((n) => n.id !== hit.id);
      state.selected.delete(hit.id);
      state.dirty = true;
      renderAll();
    }
  }

  function onCanvasWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      state.zoom = Core.clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.7, 1.65);
      renderAll();
    }
  }

  function onWaveClick(e) {
    if (!state.samples) return;
    const rect = els.waveCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * state.audioDuration;
    if (state.playing) stopPlayback(false);
    setPlayhead(Core.clamp(t, 0, state.audioDuration));
    // 波形就是全曲导航：点到后面时，下面的网格也跟过去。
    scrollToTime(state.playhead, true);
  }

  function scrollToTime(t, center) {
    const x = timeToX(t);
    const viewport = els.gridScroll.clientWidth || 1;
    const maxScroll = Math.max(0, (state.timelineWidth || 0) - viewport);
    let left = center ? x - viewport * 0.32 : x;
    left = Core.clamp(left, 0, maxScroll);
    els.gridScroll.scrollLeft = left;
    state.scrollLeft = left;
    renderRoll();
  }

  function onKeyDown(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.playing) stopPlayback(true);
      else startPlayback('notes', state.playhead);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteClipboard();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (e.key === 'Escape') {
      state.selected.clear();
      stopPlayback(true);
      renderAll();
      updateControls();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      transposeSelected(e.shiftKey ? 12 : 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      transposeSelected(e.shiftKey ? -12 : -1);
      return;
    }
    if (e.key.toLowerCase() === 'v') setTool('select');
    if (e.key.toLowerCase() === 'b') setTool('pencil');
    if (e.key.toLowerCase() === 'e') setTool('eraser');
  }

  function setPlayhead(t) {
    const end = Math.max(state.audioDuration || 0, getTimelineEnd());
    state.playhead = Core.clamp(t, 0, end || t);
    updatePlayheadUI();
  }

  /* ====================================================================== */
  /* 渲染：主画布                                                           */
  /* ====================================================================== */

  function renderAll() {
    updateTiming();
    renderRoll();
    renderWave();
    updateStatus();
    updateControls();
    updateEmptyHint();
  }

  function renderRoll() {
    const rows = state.highMidi - state.lowMidi + 1;
    if (rows <= 0) return;
    state.headerH = window.innerHeight < 680 ? 46 : 56;

    const bodyH = els.rollBody.clientHeight || 460;
    let rowH = Math.floor((bodyH - state.headerH - 3) / rows);
    rowH = Core.clamp(rowH, 10, 22);
    state.rowH = rowH;

    const viewportW = Math.max(1, els.gridScroll.clientWidth || 760);
    const visibleCells = Math.max(8, 2 * state.beatsPerBar * state.divisions);
    let cellW = Math.floor((viewportW / visibleCells) * state.zoom);
    cellW = Core.clamp(cellW, 9, 34);
    state.cellW = cellW;

    const totalCols = state.measures * state.beatsPerBar * state.divisions;
    const totalWidth = Math.max(totalCols * cellW, viewportW);
    const height = state.headerH + rows * rowH;
    const maxScroll = Math.max(0, totalWidth - viewportW);
    const scrollLeft = Core.clamp(els.gridScroll.scrollLeft || 0, 0, maxScroll);
    state.timelineWidth = totalWidth;
    state.viewW = viewportW;
    state.scrollLeft = scrollLeft;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = els.rollCanvas;
    const needResize =
      lastCanvasW !== viewportW ||
      lastCanvasH !== height ||
      canvas.width !== Math.round(viewportW * dpr) ||
      canvas.height !== Math.round(height * dpr);

    if (needResize) {
      canvas.width = Math.round(viewportW * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = viewportW + 'px';
      canvas.style.height = height + 'px';
      lastCanvasW = viewportW;
      lastCanvasH = height;
    }
    // 外层保留完整时间轴宽度，画布只画当前视口，避免长音频把 canvas
    // 撑到几万像素后触发 GPU 尺寸上限、整块变空白。
    els.canvasWrap.style.width = totalWidth + 'px';
    els.canvasWrap.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportW, height);
    ctx.fillStyle = '#c9c09b';
    ctx.fillRect(0, 0, viewportW, height);

    ctx.save();
    ctx.translate(-scrollLeft, 0);
    drawRows(ctx, scrollLeft, viewportW, rows, rowH);
    drawGridLines(ctx, height, totalCols, rowH, scrollLeft, viewportW);
    drawHeader(ctx, totalWidth, totalCols, scrollLeft, viewportW);
    drawNotes(ctx, totalWidth, height, scrollLeft, viewportW);
    drawGhost(ctx);
    ctx.restore();
    drawMarquee(ctx);

    buildLabels(rows, rowH, state.headerH);
    updatePlayheadUI();
    updateRange();
  }

  function drawRows(ctx, scrollLeft, viewW, rows, rowH) {
    const gridTop = state.headerH;
    const x = Math.max(0, scrollLeft - 2);
    const w = viewW + 4;
    for (let r = 0; r < rows; r++) {
      const midi = state.highMidi - r;
      const black = Core.isBlackKey(midi);
      const y = gridTop + r * rowH;
      let color;
      if (black) color = r % 2 ? '#b9ac83' : '#c1b48b';
      else color = r % 2 ? '#d2c6a0' : '#d7cba6';
      if (midi % 12 === 0) color = black ? '#b4a77e' : '#d0c39c';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, rowH);
      if (mmcRowDisabled(midi)) {
        ctx.fillStyle = 'rgba(122, 114, 96, 0.26)';
        ctx.fillRect(x, y, w, rowH);
      }

      // 白键行顶部一条非常淡的高光，让卷帘有一点立体感
      if (!black) {
        ctx.fillStyle = 'rgba(255, 250, 229, 0.18)';
        ctx.fillRect(x, y, w, 1);
      }
      ctx.fillStyle = 'rgba(110, 94, 61, 0.42)';
      ctx.fillRect(x, y + rowH - 1, w, 1);
    }
  }

  function drawGridLines(ctx, height, totalCols, rowH, scrollLeft, viewW) {
    const gridTop = state.headerH;
    const cellsPerBeat = state.divisions;
    const cellsPerBar = state.beatsPerBar * cellsPerBeat;
    const firstCol = Math.max(0, Math.floor(scrollLeft / state.cellW) - 1);
    const lastCol = Math.min(totalCols, Math.ceil((scrollLeft + viewW) / state.cellW) + 1);

    for (let c = firstCol; c <= lastCol; c++) {
      const x = c * state.cellW + 0.5;
      const inBar = c % cellsPerBar;
      const inBeat = c % cellsPerBeat;
      if (inBar === 0) {
        ctx.strokeStyle = 'rgba(85, 70, 43, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      } else if (inBeat === 0) {
        ctx.strokeStyle = 'rgba(111, 95, 62, 0.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, gridTop);
        ctx.lineTo(x, height);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(133, 117, 82, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, gridTop);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // 小节内浅色分隔，方便读谱
    ctx.strokeStyle = 'rgba(255, 249, 224, 0.13)';
    ctx.lineWidth = 1;
    const firstBar = Math.max(0, Math.floor(scrollLeft / (cellsPerBar * state.cellW)) - 1);
    const lastBar = Math.min(
      state.measures - 1,
      Math.ceil((scrollLeft + viewW) / (cellsPerBar * state.cellW)) + 1
    );
    for (let b = firstBar; b <= lastBar; b++) {
      const x = b * cellsPerBar * state.cellW + 1.5;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  function drawHeader(ctx, width, totalCols, scrollLeft, viewW) {
    const h = state.headerH;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#cec39d');
    grad.addColorStop(0.55, '#bdb189');
    grad.addColorStop(1, '#b1a47b');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.max(0, scrollLeft - 2), 0, viewW + 4, h);

    const barW = state.beatsPerBar * state.divisions * state.cellW;
    const beatW = state.divisions * state.cellW;
    const firstBar = Math.max(0, Math.floor(scrollLeft / barW) - 1);
    const lastBar = Math.min(state.measures - 1, Math.ceil((scrollLeft + viewW) / barW) + 1);

    for (let m = firstBar; m <= lastBar; m++) {
      const x = m * barW;
      if (m % 2 === 1) {
        ctx.fillStyle = 'rgba(255, 249, 223, 0.08)';
        ctx.fillRect(x, 0, barW, h);
      }

      ctx.fillStyle = '#4b3d24';
      ctx.font = '600 12px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const title = barW > 190 ? `第 ${m + 1} 小节  ☆` : `第${m + 1}节`;
      ctx.fillText(title, x + barW / 2, 17);

      ctx.textAlign = 'left';
      ctx.font = '10px "Cascadia Mono", Consolas, monospace';
      for (let b = 0; b < state.beatsPerBar; b++) {
        const bx = x + b * beatW;
        ctx.fillStyle = 'rgba(76, 60, 33, 0.78)';
        ctx.fillText(String(b + 1), bx + 5, h - 11);
        ctx.strokeStyle = 'rgba(99, 82, 51, 0.4)';
        ctx.beginPath();
        ctx.moveTo(bx + 0.5, h - 17);
        ctx.lineTo(bx + 0.5, h);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(92, 76, 46, 0.38)';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }

    // 顶部细分刻度
    ctx.strokeStyle = 'rgba(93, 77, 47, 0.18)';
    const firstCol = Math.max(0, Math.floor(scrollLeft / state.cellW) - 1);
    const lastCol = Math.min(totalCols, Math.ceil((scrollLeft + viewW) / state.cellW) + 1);
    for (let c = firstCol; c <= lastCol; c++) {
      if (c % state.divisions === 0) continue;
      const x = c * state.cellW + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, h - 7);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 249, 224, 0.45)';
    ctx.fillRect(Math.max(0, scrollLeft - 2), 0, viewW + 4, 1);
    ctx.fillStyle = 'rgba(86, 70, 43, 0.65)';
    ctx.fillRect(Math.max(0, scrollLeft - 2), h - 1, viewW + 4, 1);
  }

  function drawNotes(ctx, width, height, scrollLeft, viewW) {
    const step = state.step;
    const cellW = state.cellW;
    const rowH = state.rowH;
    const viewLeft = scrollLeft - 20;
    const viewRight = scrollLeft + viewW + 20;

    for (const n of state.notes) {
      const x = timeToX(n.start);
      const y = state.headerH + (state.highMidi - n.midi) * rowH;
      const w = Math.max(5, (n.duration / step) * cellW - 1.5);
      const h = Math.max(5, rowH - 2);
      if (x + w < viewLeft || x > viewRight || y + h < state.headerH || y > height) continue;

      const selected = state.selected.has(n.id);
      const part = notePart(n);
      if (state.mutedParts.has(part)) continue;
      const v = Core.clamp(n.velocity / 127, 0, 1);
      const light = 76 - v * 24;
      const hue = partColor(part);
      const sat = n.part ? 32 : 47;
      const fill = `hsl(${hue}, ${sat}%, ${light}%)`;
      const fill2 = `hsl(${hue}, ${sat}%, ${light - 9}%)`;

      if (selected) {
        ctx.save();
        ctx.shadowColor = 'rgba(43, 97, 133, 0.55)';
        ctx.shadowBlur = 7;
        ctx.fillStyle = 'rgba(52, 98, 127, 0.22)';
        roundRect(ctx, x - 1.5, y - 1, w + 3, h + 2, 3);
        ctx.fill();
        ctx.restore();
      }

      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, fill);
      grad.addColorStop(0.55, fill2);
      grad.addColorStop(1, `hsl(${hue}, ${Math.max(28, sat - 3)}%, ${light - 20}%)`);
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 2);
      ctx.fill();

      ctx.strokeStyle = selected ? '#2f6285' : 'rgba(92, 72, 35, 0.88)';
      ctx.lineWidth = selected ? 1.6 : 1;
      roundRect(ctx, x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1), 2);
      ctx.stroke();

      // 左侧重音标记
      ctx.fillStyle = 'rgba(255, 245, 203, 0.42)';
      ctx.fillRect(x + 1, y + 1, Math.min(2, w), h - 2);

      // 力度条
      const vw = Math.min(w - 2, Math.max(2, (w - 2) * v));
      ctx.fillStyle = `rgba(72, 53, 20, ${0.2 + v * 0.3})`;
      ctx.fillRect(x + 1, y + h - 3, vw, 2);

      if (w > 27) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 3, y, Math.max(0, w - 6), h);
        ctx.clip();
        ctx.fillStyle = 'rgba(46, 35, 16, 0.9)';
        ctx.font = '9px "Cascadia Mono", Consolas, monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(rowLabel(n.midi), x + 4, y + h / 2 - 0.5);
        ctx.restore();
      }

      if (selected) {
        ctx.fillStyle = '#f6edcf';
        ctx.fillRect(x + w - 2, y + 2, 2, h - 4);
      }
    }
  }

  function drawMarquee(ctx) {
    if (!state.marquee) return;
    const m = state.marquee;
    const offset = state.scrollLeft || 0;
    const x1 = m.x1 - offset;
    const x2 = m.x2 - offset;
    ctx.save();
    ctx.fillStyle = 'rgba(52, 98, 127, 0.12)';
    ctx.strokeStyle = 'rgba(52, 98, 127, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.fillRect(x1, m.y1, x2 - x1, m.y2 - m.y1);
    ctx.strokeRect(x1 + 0.5, m.y1 + 0.5, x2 - x1, m.y2 - m.y1);
    ctx.restore();
  }

  function drawGhost(ctx) {
    if (!state.hover || state.tool !== 'pencil' || state.drag) return;
    const g = state.hover;
    const x = g.col * state.cellW;
    const y = state.headerH + (state.highMidi - g.midi) * state.rowH;
    const mult = state.dotted ? 1.5 : 1;
    const w = Math.max(4, (state.noteLength * mult / state.divisions) * state.cellW - 1);
    const h = state.rowH - 2;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#a98b41';
    roundRect(ctx, x, y + 1, w, h, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(92, 72, 35, 0.75)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    roundRect(ctx, x + 0.5, y + 1.5, Math.max(1, w - 1), h - 1, 2);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function buildLabels(rows, rowH, headerH) {
    const key = [state.lowMidi, state.highMidi, rowH, headerH, state.timbre, state.mmcFormat].join(':');
    if (labelsKey === key) return;
    labelsKey = key;
    const frag = document.createDocumentFragment();
    const head = document.createElement('div');
    head.className = 'labels-head';
    head.style.height = headerH + 'px';
    frag.appendChild(head);
    for (let midi = state.highMidi; midi >= state.lowMidi; midi--) {
      const d = document.createElement('div');
      d.className =
        'pitch-label' +
        (Core.isBlackKey(midi) ? ' black' : '') +
        (midi % 12 === 0 ? ' octave' : '') +
        (mmcRowDisabled(midi) ? ' disabled' : '');
      d.style.height = rowH + 'px';
      d.textContent = rowLabel(midi);
      frag.appendChild(d);
    }
    els.pitchLabels.replaceChildren(frag);
  }

  /* ====================================================================== */
  /* 渲染：波形                                                             */
  /* ====================================================================== */

  function renderWave() {
    const canvas = els.waveCanvas;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#362c1f');
    bg.addColorStop(0.52, '#271f16');
    bg.addColorStop(1, '#211a12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 横向刻度
    ctx.strokeStyle = 'rgba(196, 168, 104, 0.09)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (!state.samples || !state.wavePeaks) {
      ctx.strokeStyle = 'rgba(170, 147, 99, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2 + 0.5);
      ctx.lineTo(w, h / 2 + 0.5);
      ctx.stroke();
      els.wavePlayhead.classList.add('hidden');
      if (els.waveView) els.waveView.classList.add('hidden');
      return;
    }

    const duration = state.audioDuration || state.samples.length / state.sampleRate;

    // 小节底色
    if (state.barDur > 0) {
      const startM = Math.floor((0 - state.origin) / state.barDur);
      const endM = Math.ceil((duration - state.origin) / state.barDur);
      for (let m = startM; m < endM; m++) {
        const t0 = Math.max(0, state.origin + m * state.barDur);
        const t1 = Math.min(duration, state.origin + (m + 1) * state.barDur);
        if (t1 <= t0) continue;
        const x0 = (t0 / duration) * w;
        const x1 = (t1 / duration) * w;
        if (m % 2 === 0) {
          ctx.fillStyle = 'rgba(207, 176, 98, 0.035)';
          ctx.fillRect(x0, 0, x1 - x0, h);
        }
        ctx.strokeStyle = 'rgba(196, 168, 104, 0.22)';
        ctx.beginPath();
        ctx.moveTo(Math.round(x0) + 0.5, 0);
        ctx.lineTo(Math.round(x0) + 0.5, h);
        ctx.stroke();
      }
    }

    // 波形
    const peaks = state.wavePeaks;
    const mid = h / 2 + 2;
    const amp = h * 0.39;
    ctx.strokeStyle = 'rgba(212, 181, 103, 0.62)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * peaks.length);
      const val = peaks[Math.min(peaks.length - 1, idx)] || 0;
      const y = val * amp;
      ctx.globalAlpha = 0.45 + Math.min(0.45, val * 1.8);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, mid - y);
      ctx.lineTo(x + 0.5, mid + y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 音符起点刻线
    ctx.fillStyle = 'rgba(239, 205, 120, 0.38)';
    for (const n of state.notes) {
      const x = (n.start / duration) * w;
      if (x < 0 || x > w) continue;
      ctx.fillRect(x, h - 7, 1, 5);
    }

    // 播放头
    els.wavePlayhead.classList.remove('hidden');
    const px = (state.playhead / duration) * w;
    els.wavePlayhead.style.left = Core.clamp(px, 0, w) + 'px';
    els.wavePlayhead.style.height = h + 'px';
    updateWaveView(els.gridScroll.scrollLeft || 0, els.gridScroll.clientWidth || 1);
  }

  function buildWavePeaks(samples, count) {
    const peaks = new Float32Array(count);
    if (!samples || !samples.length) return peaks;
    const block = Math.max(1, Math.floor(samples.length / count));
    for (let i = 0; i < count; i++) {
      const start = i * block;
      const end = Math.min(samples.length, start + block);
      let max = 0;
      for (let j = start; j < end; j += 2) {
        const v = Math.abs(samples[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  /* ====================================================================== */
  /* 状态 / UI                                                              */
  /* ====================================================================== */

  function updatePlayheadUI() {
    if (!els.playhead) return;
    const x = timeToX(state.playhead);
    const timelineWidth = state.timelineWidth || els.canvasWrap.clientWidth || 1;
    const clamped = Core.clamp(x, 0, Math.max(0, timelineWidth - 1));
    els.playhead.classList.remove('hidden');
    els.playhead.style.left = clamped + 'px';
    els.playhead.style.height = (lastCanvasH || els.rollCanvas.clientHeight) + 'px';

    if (state.samples) {
      const dur = state.audioDuration || 1;
      const rect = els.waveCanvas.getBoundingClientRect();
      const wx = Core.clamp((state.playhead / dur) * rect.width, 0, rect.width);
      els.wavePlayhead.classList.remove('hidden');
      els.wavePlayhead.style.left = wx + 'px';
      els.wavePlayhead.style.height = rect.height + 'px';
    }
  }

  function updateRange() {
    if (!els.statusRange) return;
    const barW = state.beatsPerBar * state.divisions * state.cellW;
    const scrollLeft = els.gridScroll.scrollLeft || 0;
    const viewport = els.gridScroll.clientWidth || 1;
    let start = Math.floor(scrollLeft / barW) + 1;
    // 只把至少露出 12% 的小节计入可见范围，避免状态栏总是多报一节。
    let end = Math.ceil((scrollLeft + viewport - barW * 0.12) / barW);
    start = Core.clamp(start, 1, state.measures);
    end = Core.clamp(end, start, state.measures);
    const range = start === end ? `第 ${start} 节` : `第 ${start}–${end} 节`;
    els.statusRange.textContent = `${range} / 共 ${state.measures} 节`;
    updateWaveView(scrollLeft, viewport);
  }

  function updateWaveView(scrollLeft, viewport) {
    if (!els.waveView) return;
    if (!state.samples || !state.audioDuration || state.headerH === 0) {
      els.waveView.classList.add('hidden');
      return;
    }
    const rect = els.waveCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      els.waveView.classList.add('hidden');
      return;
    }
    const secondsPerPixel = state.step / state.cellW;
    const startT = Core.clamp(
      state.origin + scrollLeft * secondsPerPixel,
      0,
      state.audioDuration
    );
    const endT = Core.clamp(
      state.origin + (scrollLeft + viewport) * secondsPerPixel,
      0,
      state.audioDuration
    );
    const x1 = (startT / state.audioDuration) * rect.width;
    const x2 = (endT / state.audioDuration) * rect.width;
    els.waveView.classList.remove('hidden');
    els.waveView.style.left = Math.round(x1) + 'px';
    els.waveView.style.width = Math.max(2, Math.round(x2 - x1)) + 'px';
  }

  function onGridScroll() {
    updateRange();
    if (gridScrollRaf) return;
    gridScrollRaf = requestAnimationFrame(() => {
      gridScrollRaf = 0;
      // 画布只画当前视口；滚动时必须重绘，否则会看到空白。
      renderRoll();
    });
  }

  function updateStatus() {
    els.statusBpmValue.textContent = formatBpm(state.bpm);
    els.statusMeterValue.textContent = state.beatsPerBar + '/' + state.beatUnit;
    const gridDenom = state.beatUnit * state.divisions;
    els.statusGrid.textContent = state.quantize ? '对齐 1/' + gridDenom : '自由节奏';
    els.statusTimbre.textContent = '音色：' + TIMBRES[state.timbre].label +
      (state.autoTimbre ? '（自动匹配）' : '') + ' ›';

    if (state.samples || state.notes.length) {
      const dur = state.audioDuration || 0;
      const conf = state.analysis ? ' · 置信 ' + Math.round((state.analysis.confidence || 0) * 100) + '%' : '';
      const sens =
        state.analysis && state.analysis.mode === 'poly'
          ? ' · 复音'
          : state.analysis && state.analysis.sensitivity !== 3
            ? ' · ' + (state.analysis.sensitivityLabel || '')
            : '';
      els.waveInfo.textContent = `${formatDuration(dur)} · ${state.notes.length} 音符 · ${formatBpm(state.bpm)} BPM${conf}${sens}`;
    } else {
      els.waveInfo.textContent = '等待音频 · 支持常见格式';
    }
    updateRange();
  }

  function updateControls() {
    $$('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === state.tool));
    $$('.len-btn[data-length]').forEach((b) => {
      b.classList.toggle('active', Math.abs(parseFloat(b.dataset.length) - state.noteLength) < 0.001);
    });
    els.dottedBtn.classList.toggle('active', state.dotted);
    $$('.vel-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.velocity, 10) === state.velocity);
    });

    els.undoBtn.disabled = undoStack.length === 0;
    els.redoBtn.disabled = redoStack.length === 0;
    els.deleteBtn.disabled = state.selected.size === 0;
    els.exportMidiBtn.disabled = state.notes.length === 0;
    els.analyzeBtn.disabled = !state.samples || state.analyzing;
    els.analyzeBtn.classList.toggle(
      'attention',
      !!(state.analysis && state.sensitivity !== state.analysis.sensitivity)
    );
    els.originalBtn.disabled = !state.samples;
    els.sourceDownloadBtn.disabled = !state.samples;
    els.sourceWavBtn.disabled = !state.samples;
    els.transWavBtn.disabled = state.notes.length === 0 || state.renderingWav;
    els.simplifyMiniBtn.disabled = state.notes.length <= 1 || state.renderingWav;
    els.reflowBtn.disabled = state.rawNotes.length === 0;
    els.fineBtn.disabled = !state.samples && state.notes.length === 0;
    els.simplifyBtn.disabled = state.notes.length === 0 || state.notes.length <= 1;
    els.recordBtn.classList.toggle('active', state.recording);

    els.playBtn.classList.toggle('active', state.playing && state.playMode === 'notes');
    els.originalBtn.classList.toggle('active', state.playing && state.playMode === 'original');
    els.originalBtn.textContent = state.playing && state.playMode === 'original' ? '■ 停止原音' : '▶ 原音';

    els.fileName.textContent = state.audioName || '未加载音频';
    els.fileMeta.textContent = state.samples
      ? `${formatDuration(state.audioDuration)} · ${formatBpm(state.bpm)} BPM · ${state.notes.length} 音符`
      : state.notes.length
        ? `导入谱面 · ${state.notes.length} 音符 · ${formatBpm(state.bpm)} BPM`
        : 'WAV / MP3 / FLAC / M4A / OGG / NCM / MIDI · 单音旋律';
    document.title = state.audioName
      ? `${state.audioName} · 旋律抄谱机`
      : '旋律抄谱机 · Melody Scribe';
  }

  function syncControls() {
    if (document.activeElement !== els.bpmInput) els.bpmInput.value = formatBpm(state.bpm);
    els.modeSelect.value = state.recognitionMode;
    if (els.engineSelect) els.engineSelect.value = state.recognitionEngine;
    els.meterSelect.value = state.beatsPerBar + '/' + state.beatUnit;
    els.gridSelect.value = String(state.divisions);
    els.quantizeInput.checked = state.quantize;
    els.sensitivityInput.value = String(state.sensitivity);
    els.sensitivityLabel.textContent = (SENSITIVITY_PRESETS[state.sensitivity - 1] || {}).label || '标准';
    els.brightInput.value = String(state.brightness);
    els.brightValue.textContent = '+' + state.brightness + ' dB';
    els.reverbInput.value = String(state.reverb);
    els.reverbValue.textContent = state.reverb + '%';
    els.tuningInput.value = String(state.tuning);
    els.tuningValue.textContent = (state.tuning >= 0 ? '+' : '') + state.tuning + ' 音分';
    updateControls();
  }

  function updateEmptyHint() {
    els.emptyHint.classList.toggle('hidden', state.notes.length > 0);
  }

  function focusBpm() {
    els.bpmInput.focus();
    els.bpmInput.select();
    els.bpmInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function focusMeter() {
    els.meterSelect.focus();
    els.meterSelect.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function toggleMmcFormat() {
    state.mmcFormat = !state.mmcFormat;
    if (state.mmcFormat) {
      state.lowMidi = 48;
      state.highMidi = 71;
    } else if (TIMBRES[state.timbre].drum) {
      state.lowMidi = 35;
      state.highMidi = 81;
    } else {
      state.lowMidi = 48;
      state.highMidi = 71;
    }
    labelsKey = '';
    if (els.mmcBtn) els.mmcBtn.classList.toggle('active', state.mmcFormat);
    renderAll();
    showToast(state.mmcFormat
      ? 'MMC 格式 · 灰色为未映射 / 不可用音域'
      : '已切回普通音名格式');
  }

  function chooseAutoTimbre() {
    if (!state.autoTimbre) return;
    const notes = state.notes || [];
    let id = 'grand';
    if (notes.length) {
      let low = 0, high = 0, drums = 0, totalDur = 0;
      for (const n of notes) {
        if (n.midi <= 50) low++;
        if (n.midi >= 72) high++;
        if (notePart(n) === 'drums') drums++;
        totalDur += n.duration || 0;
      }
      const avgDur = totalDur / notes.length;
      if (drums / notes.length > 0.38) id = 'drums';
      else if (low / notes.length > 0.58 && avgDur < 1.4) id = 'bass';
      else if (avgDur < 0.22 && high / notes.length > 0.3) id = 'guitar';
      else if (high / notes.length > 0.55 && avgDur > 0.55) id = 'violin';
      else id = 'grand';
    }
    const index = TIMBRES.findIndex((t) => t.id === id);
    state.timbre = index >= 0 ? index : 1;
    if (id === 'grand') loadGrandSamples().catch(() => {});
    updateStatus();
  }

  function buildTimbreMenu() {
    const menu = els.timbreMenu;
    if (!menu) return;
    menu.replaceChildren();
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = state.autoTimbre ? 'active' : '';
    autoBtn.textContent = '自动匹配（推荐）';
    autoBtn.addEventListener('click', () => {
      if (state.playing) stopPlayback(false);
      state.autoTimbre = true;
      chooseAutoTimbre();
      menu.hidden = true;
      updateStatus();
      renderAll();
    });
    menu.appendChild(autoBtn);
    TIMBRES.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.label;
      b.className = i === state.timbre ? 'active' : '';
      b.addEventListener('click', () => {
        if (state.playing) stopPlayback(false);
        state.autoTimbre = false;
        state.timbre = i;
        if (t.id === 'grand') {
          loadGrandSamples().catch(() => {
            showToast('大钢琴采样加载失败，暂时使用合成钢琴', 'error');
          });
        }
        if (state.mmcFormat) {
          state.lowMidi = 48;
          state.highMidi = 71;
        } else if (t.drum) {
          state.lowMidi = 35;
          state.highMidi = 81;
        } else if (state.lowMidi === 35 && state.highMidi === 81) {
          state.lowMidi = 48;
          state.highMidi = 71;
        }
        menu.hidden = true;
        updateStatus();
        renderAll();
        showToast('播放音色：' + t.label);
      });
      menu.appendChild(b);
    });
  }

  function toggleTimbreMenu() {
    let menu = els.timbreMenu;
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'timbre-menu';
      menu.id = 'timbreMenu';
      menu.hidden = true;
      document.body.appendChild(menu);
      els.timbreMenu = menu;
    }
    if (!menu.hidden) {
      menu.hidden = true;
      return;
    }
    buildTimbreMenu();
    const r = els.statusTimbre.getBoundingClientRect();
    menu.hidden = false;
    const width = menu.offsetWidth || 240;
    const height = menu.offsetHeight || 160;
    menu.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, r.left)) + 'px';
    menu.style.top = Math.max(8, r.top - height - 8) + 'px';
  }

  function jumpToNote(direction) {
    if (!state.notes.length) {
      showToast('还没有可跳转的音符');
      return;
    }
    const sorted = state.notes.slice().sort((a, b) => a.start - b.start || a.midi - b.midi);
    let target = null;
    if (direction > 0) {
      target = sorted.find((n) => n.start > state.playhead + 1e-6);
      if (!target) {
        showToast('已经是最后一个音符');
        return;
      }
    } else {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].start < state.playhead - 1e-6) {
          target = sorted[i];
          break;
        }
      }
      if (!target) {
        showToast('已经是第一个音符');
        return;
      }
    }
    state.selected = new Set([target.id]);
    state.playhead = target.start;
    scrollToTime(target.start, true);
    updatePlayheadUI();
    renderAll();
    const measure = target.measure || (Math.floor(Math.max(0, target.start - state.origin) / state.barDur) + 1);
    showToast(`第 ${measure} 小节 · ${Core.midiToName(target.midi)} · ${formatDuration(target.start)}`);
  }

  /* ====================================================================== */
  /* 设置变更                                                               */
  /* ====================================================================== */

  function onEngineChange() {
    state.recognitionEngine = els.engineSelect.value === 'online' ? 'online' : 'offline';
    if (els.engineHint) {
      els.engineHint.textContent = state.recognitionEngine === 'online'
        ? '在线模式调用本机 SheetSage2，精度更高；首次使用会要求选择 SheetSage2 文件夹。'
        : '离线模式完全本地运行，使用内置 BasicPitch，不需要联网。';
    }
    updateControls();
  }

  function onModeChange() {
    state.recognitionMode = els.modeSelect.value === 'poly' ? 'poly' : 'mono';
    showToast(
      state.recognitionMode === 'poly'
        ? '识别模式：伴奏 / 复音 · 点顶部「开始识别」（复音模型首次加载会慢一些）'
        : '识别模式：单音旋律 · 点顶部「开始识别」'
    );
    updateControls();
  }

  function onBpmChange() {
    const old = state.bpm;    const value = parseFloat(els.bpmInput.value);
    if (!Number.isFinite(value)) {
      els.bpmInput.value = formatBpm(old);
      return;
    }
    const bpm = Core.clamp(value, 40, 240);
    if (Math.abs(bpm - old) < 0.001) {
      els.bpmInput.value = formatBpm(old);
      return;
    }
    if (state.dirty && state.rawNotes.length) {
      const ok = window.confirm('修改速度会按原始识别结果重新分小节，并覆盖手动修改。继续吗？');
      if (!ok) {
        els.bpmInput.value = formatBpm(old);
        return;
      }
      state.dirty = false;
    }
    pushUndo();
    state.bpm = bpm;
    updateTiming();
    if (state.rawNotes.length) {
      if (!reflow({ force: true, push: false })) {
        state.bpm = old;
        updateTiming();
        els.bpmInput.value = formatBpm(old);
        return;
      }
    } else {
      recomputeManualMeasures();
      renderAll();
    }
    syncControls();
  }

  function onMeterChange() {
    const parts = els.meterSelect.value.split('/').map(Number);
    const oldBeats = state.beatsPerBar;
    const oldUnit = state.beatUnit;
    if (state.dirty && state.rawNotes.length) {
      const ok = window.confirm('修改拍号会重新分小节，并覆盖手动修改。继续吗？');
      if (!ok) {
        els.meterSelect.value = oldBeats + '/' + oldUnit;
        return;
      }
      state.dirty = false;
    }
    pushUndo();
    state.beatsPerBar = parts[0];
    state.beatUnit = parts[1];
    updateTiming();
    if (state.rawNotes.length) {
      reflow({ force: true, push: false });
    } else {
      recomputeManualMeasures();
      renderAll();
    }
    syncControls();
  }

  function onGridChange() {
    const value = parseInt(els.gridSelect.value, 10) || 4;
    if (state.dirty && state.rawNotes.length) {
      const ok = window.confirm('修改网格会重新量化音符，并覆盖手动修改。继续吗？');
      if (!ok) {
        els.gridSelect.value = String(state.divisions);
        return;
      }
      state.dirty = false;
    }
    pushUndo();
    state.divisions = value;
    updateTiming();
    if (state.rawNotes.length) {
      reflow({ force: true, push: false });
    } else {
      recomputeManualMeasures();
      renderAll();
    }
    syncControls();
  }

  function onQuantizeChange() {
    const desired = els.quantizeInput.checked;
    if (state.dirty && state.rawNotes.length) {
      const ok = window.confirm('切换网格对齐会重新量化音符，并覆盖手动修改。继续吗？');
      if (!ok) {
        els.quantizeInput.checked = !desired;
        return;
      }
      state.dirty = false;
    }
    pushUndo();
    state.quantize = desired;
    if (state.rawNotes.length) {
      reflow({ force: true, push: false });
    } else {
      renderAll();
    }
    updateStatus();
  }

  function onToneChange() {
    state.brightness = Core.clamp(parseInt(els.brightInput.value, 10) || 0, 0, 12);
    state.reverb = Core.clamp(parseInt(els.reverbInput.value, 10) || 0, 0, 40);
    state.tuning = Core.clamp(parseInt(els.tuningInput.value, 10) || 0, -50, 50);
    els.brightValue.textContent = '+' + state.brightness + ' dB';
    els.reverbValue.textContent = state.reverb + '%';
    els.tuningValue.textContent = (state.tuning >= 0 ? '+' : '') + state.tuning + ' 音分';
    if (toneBright) toneBright.gain.value = state.brightness;
    if (toneWet) toneWet.gain.value = state.reverb / 100;
    if (toneDry) toneDry.gain.value = 0.82 - (state.reverb / 100) * 0.25;
  }

  function onSensitivityChange() {
    const level = Core.clamp(parseInt(els.sensitivityInput.value, 10) || 3, 1, 5);
    state.sensitivity = level;
    const preset = SENSITIVITY_PRESETS[level - 1];
    els.sensitivityLabel.textContent = preset.label;
    if (state.samples) {
      showToast(
        `灵敏度：${preset.label} · 点顶部「开始识别」重新分析（当前音符不会被自动覆盖）`
      );
    }
    updateControls();
  }

  /* ====================================================================== */
  /* 播放                                                                   */
  /* ====================================================================== */

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.7;
      // 复音伴奏有大量同时发声的音符，用压缩器当作简易限幅器。
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.2;
      const bright = audioCtx.createBiquadFilter();
      bright.type = 'highshelf';
      bright.frequency.value = 3000;
      bright.gain.value = state.brightness;
      const lowCut = audioCtx.createBiquadFilter();
      lowCut.type = 'highpass';
      lowCut.frequency.value = 50;
      lowCut.Q.value = 0.7;
      const dry = audioCtx.createGain();
      dry.gain.value = 0.82 - (state.reverb / 100) * 0.25;
      toneDry = dry;
      toneBright = bright;
      masterGain.connect(dry);
      dry.connect(lowCut);
      lowCut.connect(bright);
      bright.connect(compressor);

      // 简易立体声混响，让复音播放不至于太干、太电子
      const convolver = audioCtx.createConvolver();
      const irLen = Math.floor(audioCtx.sampleRate * 1.1);
      const ir = audioCtx.createBuffer(2, irLen, audioCtx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        let seed = 17 + ch * 31;
        for (let i = 0; i < irLen; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const noise = seed / 2147483648 - 1;
          data[i] = noise * Math.exp((-i / audioCtx.sampleRate) * 4.2) * 0.55;
        }
      }
      convolver.buffer = ir;
      const wet = audioCtx.createGain();
      wet.gain.value = state.reverb / 100;
      toneWet = wet;
      masterGain.connect(convolver);
      convolver.connect(wet);
      wet.connect(compressor);
      compressor.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playbackSignature(notes) {
    let h = 2166136261;
    for (const n of notes) {
      h = Math.imul(h ^ (n.midi | 0), 16777619);
      h = Math.imul(h ^ Math.round(n.start * 1000), 16777619);
      h = Math.imul(h ^ Math.round((n.end || n.start + n.duration) * 1000), 16777619);
      h = Math.imul(h ^ (n.velocity | 0), 16777619);
    }
    h = Math.imul(h ^ Math.round(state.brightness || 0), 16777619);
    h = Math.imul(h ^ Math.round(state.reverb || 0), 16777619);
    h = Math.imul(h ^ Math.round(state.tuning || 0), 16777619);
    return [h >>> 0, notes.length, state.timbre, Array.from(state.mutedParts).sort().join(',')].join(':');
  }

  async function buildPlaybackBuffer(notes) {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) throw new Error('当前浏览器不支持离线音频渲染');
    const sampleRate = 22050;
    const duration = Math.min(600, Math.max(0.5, getTimelineEnd()));
    const length = Math.max(1, Math.ceil(duration * sampleRate));
    const offline = new Ctx(1, length, sampleRate);
    const master = offline.createGain();
    master.gain.value = 0.8;
    const filter = offline.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 6500;
    const bright = offline.createBiquadFilter();
    bright.type = 'highshelf';
    bright.frequency.value = 3000;
    bright.gain.value = 3;
    const lowCut = offline.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 50;
    lowCut.Q.value = 0.7;
    master.connect(lowCut);
    lowCut.connect(bright);
    bright.connect(filter);
    filter.connect(offline.destination);

    const oldCtx = audioCtx;
    const oldMaster = masterGain;
    const activeStart = activeNodes.length;
    audioCtx = offline;
    masterGain = master;
    try {
      for (const n of notes) {
        const t = Math.max(0, n.start);
        if (t >= duration) continue;
        const d = Math.max(0.06, Math.min(n.duration + 0.08, duration - t));
        makeVoice(n, t, d, true);
      }
    } finally {
      audioCtx = oldCtx;
      masterGain = oldMaster;
      activeNodes.length = activeStart;
    }
    const rendered = await offline.startRendering();
    const data = rendered.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
    if (peak > 1e-6) {
      const scale = 0.95 / peak;
      for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
    const buffer = audioCtx.createBuffer(1, data.length, sampleRate);
    buffer.copyToChannel(data, 0);
    return buffer;
  }

  async function startPlayback(mode, from) {
    if (mode === 'notes' && !state.notes.length) {
      showToast('还没有可播放的音符');
      return;
    }
    if (mode === 'original' && !state.samples) {
      showToast('还没有载入音频');
      return;
    }
    const ctx = ensureAudioContext();
    stopPlayback(false);
    if (mode === 'notes' && state.timbre === 'grand' && !grandBuffers) {
      try {
        await loadGrandSamples();
      } catch (err) {
        console.error(err);
        showToast('大钢琴采样加载失败，暂时使用合成钢琴', 'error');
      }
    }

    const total = mode === 'original' ? state.audioDuration : getTimelineEnd();
    let startAt = from || 0;
    if (startAt >= total - 0.02) startAt = 0;
    const startTime = ctx.currentTime + 0.075;

    state.playing = true;
    state.playMode = mode;
    state.playFrom = startAt;
    state.playStartCtx = startTime;
    state.playhead = startAt;
    scrollToTime(startAt, true);

    if (mode === 'notes' && state.previewBuffer) {
      previewSource = ctx.createBufferSource();
      previewSource.buffer = state.previewBuffer;
      // 直接接输出，避开试听音色/混响，保证和载入的生成音频完全一致
      previewSource.connect(ctx.destination);
      previewSource.start(
        startTime,
        Math.min(startAt, Math.max(0, state.previewBuffer.duration - 0.01))
      );
    } else if (mode === 'original') {
      const buffer = ensureAudioBuffer();
      if (!buffer) {
        state.playing = false;
        showToast('原始音频不可用', 'error');
        return;
      }
      originalSource = ctx.createBufferSource();
      originalSource.buffer = buffer;
      originalSource.connect(masterGain);
      originalSource.start(startTime, Math.min(startAt, buffer.duration - 0.01));
      originalSource.stop(startTime + Math.max(0.05, buffer.duration - startAt + 0.1));
      originalSource.onended = () => {
        if (state.playing && state.playMode === 'original') {
          // rAF 会负责收尾
        }
      };
    } else {
      // 大量音符不能一次性建节点；用短窗口滚动调度，避免主线程一次性创建上千个振荡器。
      playbackNotes = state.notes
        .filter((n) => !state.mutedParts.has(notePart(n)))
        .slice()
        .sort((a, b) => a.start - b.start || a.midi - b.midi);
      scheduleIndex = 0;
      while (
        scheduleIndex < playbackNotes.length &&
        playbackNotes[scheduleIndex].end <= startAt
      ) {
        scheduleIndex++;
      }
      schedulePolyWindow();
      scheduleTimer = setInterval(schedulePolyWindow, 80);
    }

    updateControls();
    updatePlayheadUI();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickPlayback);
  }

  function schedulePolyWindow() {
    if (!state.playing || state.playMode !== 'notes' || !audioCtx) return;
    const now = state.playFrom + Math.max(0, audioCtx.currentTime - state.playStartCtx);
    const horizon = now + 0.38;
    while (scheduleIndex < playbackNotes.length) {
      const n = playbackNotes[scheduleIndex];
      if (n.start > horizon) break;
      scheduleIndex++;
      if (n.end <= now) continue;
      const when = state.playStartCtx + Math.max(0, n.start - state.playFrom);
      // 已经晚于当前时间的音符直接跳过，避免补触发造成杂音
      if (when < audioCtx.currentTime - 0.04) continue;
      const dur = Math.max(0.06, n.end - Math.max(n.start, state.playFrom));
      makePolyVoice(n, when, dur);
    }
  }

  const TONE_PROFILES = {
    piano: {
      attack: 0.005, decay: 0.62, sustain: 0.20, release: 0.18,
      filter: 3800, q: 0.7, gain: 0.20,
      osc: [['triangle', 1, 1], ['sine', 2, 0.22], ['sine', 3, 0.07]],
    },
    acoustic: {
      attack: 0.004, decay: 0.24, sustain: 0.07, release: 0.16,
      filter: 3000, q: 1.1, gain: 0.26, pluck: 0.22,
      osc: [['triangle', 1, 1], ['sawtooth', 1, 0.55], ['sine', 2, 0.14]],
    },
    bass: {
      attack: 0.009, decay: 0.48, sustain: 0.48, release: 0.22,
      filter: 900, q: 2.1, gain: 0.07,
      osc: [['sine', 1, 1], ['triangle', 1, 0.42], ['sawtooth', 0.5, 0.16]],
    },
    cello: {
      attack: 0.075, decay: 0.32, sustain: 0.72, release: 0.28,
      filter: 1550, q: 1.0, gain: 0.18, vibrato: 5, vibratoDepth: 3,
      osc: [['sawtooth', 1, 1], ['sawtooth', 1.004, 0.55], ['triangle', 0.5, 0.3]],
    },
    recorder: {
      attack: 0.045, decay: 0.18, sustain: 0.58, release: 0.16,
      filter: 3200, q: 1.1, gain: 0.16, breath: 0.08,
      osc: [['sine', 1, 1], ['triangle', 2, 0.18], ['sine', 3, 0.06]],
    },
    guitar: {
      attack: 0.005, decay: 0.22, sustain: 0.12, release: 0.16,
      filter: 2700, q: 0.9, gain: 0.26, chorus: 4,
      osc: [['sawtooth', 1, 1], ['triangle', 1, 0.7], ['sine', 2, 0.14]],
    },
    distortion: {
      attack: 0.006, decay: 0.28, sustain: 0.52, release: 0.18,
      filter: 2450, q: 1.4, gain: 0.26, drive: 24,
      osc: [['sawtooth', 1, 1], ['square', 1, 0.45], ['sine', 0.5, 0.18]],
    },
    sax: {
      attack: 0.035, decay: 0.20, sustain: 0.62, release: 0.20,
      filter: 1900, q: 2.4, gain: 0.30, vibrato: 6, vibratoDepth: 4, bandpass: true,
      osc: [['sawtooth', 1, 1], ['square', 1, 0.18], ['sine', 2, 0.08]],
    },
    violin: {
      attack: 0.060, decay: 0.22, sustain: 0.70, release: 0.26,
      filter: 3500, q: 1.1, gain: 0.20, vibrato: 5.5, vibratoDepth: 3,
      osc: [['sawtooth', 1, 1], ['sawtooth', 1.005, 0.65], ['triangle', 2, 0.12]],
    },
  };

  const GRAND_SAMPLES = [
    { midi: 36, file: 'C2.mp3' },
    { midi: 48, file: 'C3.mp3' },
    { midi: 60, file: 'C4.mp3' },
    { midi: 72, file: 'C5.mp3' },
    { midi: 84, file: 'C6.mp3' },
    { midi: 96, file: 'C7.mp3' },
  ];
  let grandBuffers = null;
  let grandLoadPromise = null;

  async function loadGrandSamples() {
    if (grandBuffers) return grandBuffers;
    if (grandLoadPromise) return grandLoadPromise;
    grandLoadPromise = (async () => {
      const ctx = ensureAudioContext();
      const encoded = window.GRAND_PIANO_B64 || {};
      const buffers = {};
      await Promise.all(GRAND_SAMPLES.map(async (item) => {
        const b64 = encoded[item.midi];
        if (!b64) throw new Error('piano sample missing: ' + item.file);
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        buffers[item.midi] = await ctx.decodeAudioData(bytes.buffer);
      }));
      grandBuffers = buffers;
      return buffers;
    })().catch((err) => {
      grandLoadPromise = null;
      throw err;
    });
    return grandLoadPromise;
  }

  function nearestGrandSample(midi) {
    let best = GRAND_SAMPLES[0];
    let dist = Math.abs(midi - best.midi);
    for (const item of GRAND_SAMPLES) {
      const d = Math.abs(midi - item.midi);
      if (d < dist) { best = item; dist = d; }
    }
    return best;
  }

  function makeGrandVoice(note, when, duration) {
    const ctx = audioCtx;
    if (!ctx || !grandBuffers) return false;
    const sample = nearestGrandSample(note.midi);
    const buffer = grandBuffers[sample.midi];
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rate = Math.pow(2, (note.midi - sample.midi) / 12 + state.tuning / 1200);
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    const v = Core.clamp(note.velocity / 127, 0.05, 1);
    const peak = Math.pow(v, 1.1) * 0.34;
    const hold = Math.max(0.1, Math.min(duration, 6));
    const stopAt = when + hold + 0.12;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), when + 0.006);
    gain.gain.setValueAtTime(Math.max(0.0002, peak * 0.82), when + Math.min(0.2, hold * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    src.connect(gain);
    gain.connect(masterGain);
    src.start(when);
    src.stop(Math.min(stopAt, when + buffer.duration / rate + 0.02));
    activeNodes.push(src, gain);
    src.onended = () => {
      activeNodes = activeNodes.filter((x) => x !== src && x !== gain);
    };
    return true;
  }

  function makePolyVoice(note, when, duration) {
    const ctx = audioCtx;
    if (!ctx) return;
    const timbre = TIMBRES[state.timbre];
    if (!timbre) return;
    if (timbre.drum) {
      playDrum(note, when, true);
      return;
    }
    if (timbre.id === 'grand' && makeGrandVoice(note, when, duration)) return;
    const profile = TONE_PROFILES[timbre.id] || TONE_PROFILES.piano;
    const freq = Core.midiToFreq(note.midi) * Math.pow(2, state.tuning / 1200);
    const v = Core.clamp(note.velocity / 127, 0.05, 1);
    // 轻量复音声部：一个振荡器 + 每音色低通/带通 + 包络。
    const gain = ctx.createGain();
    const peak = Math.pow(v, 1.15) * profile.gain * 0.32;
    const attack = Math.min(0.02, Math.max(0.003, profile.attack || 0.005));
    const hold = Math.max(0.08, Math.min(duration, 6));
    const stopAt = when + hold + 0.1;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, peak * 0.3),
      when + attack + Math.min(0.18, hold * 0.35)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    const filter = ctx.createBiquadFilter();
    filter.type = profile.bandpass ? 'bandpass' : 'lowpass';
    filter.frequency.value = profile.filter || 3200;
    filter.Q.value = profile.q || 0.8;

    const osc = ctx.createOscillator();
    // 用音色自己的主波形，再经过滤波器；这样切换音色会真的改变听感。
    osc.type = profile.osc && profile.osc[0] ? profile.osc[0][0] : 'triangle';
    osc.frequency.value = freq;
    let tail = filter;
    osc.connect(filter);
    if (profile.drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(profile.drive);
      shaper.oversample = '2x';
      filter.connect(shaper);
      tail = shaper;
    }
    tail.connect(gain);
    gain.connect(masterGain);
    osc.start(when);
    osc.stop(stopAt);
    activeNodes.push(osc, filter, gain, tail);
    osc.onended = () => {
      activeNodes = activeNodes.filter((x) => x !== osc && x !== filter && x !== gain && x !== tail);
    };
  }

  let noiseBuffer = null;
  function getNoiseBuffer(ctx) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  let distortionCurveCache = null;
  function makeDistortionCurve(amount) {
    if (distortionCurveCache) return distortionCurveCache;
    const n = 44100;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) /
        (Math.PI + amount * Math.abs(x));
    }
    distortionCurveCache = curve;
    return curve;
  }

  function finishVoice(nodes, when, stopAt) {
    for (const node of nodes) {
      if (node.start) node.start(when);
      if (node.stop) node.stop(stopAt);
      activeNodes.push(node);
      if (node.onended !== undefined) {
        node.onended = () => {
          activeNodes = activeNodes.filter((x) => x !== node);
        };
      }
    }
  }

  function makeVoice(note, when, duration, isPoly) {
    const ctx = audioCtx;
    if (!ctx) return;
    const timbre = TIMBRES[state.timbre];
    if (timbre.drum) {
      playDrum(note, when, isPoly);
      return;
    }
    if (timbre.id === 'grand' && makeGrandVoice(note, when, duration)) return;
    const profile = TONE_PROFILES[timbre.id] || TONE_PROFILES.piano;
    const freq = Core.midiToFreq(note.midi) * Math.pow(2, state.tuning / 1200);
    const v = Core.clamp(note.velocity / 127, 0.05, 1);
    const peak = Math.pow(v, 1.15) * profile.gain * (isPoly ? 0.34 : 1);
    const d = Math.max(0.08, Math.min(6, duration));
    const release = profile.release;
    const stopAt = when + d + release + 0.04;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), when + profile.attack);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, peak * profile.sustain),
      when + profile.attack + profile.decay
    );
    gain.gain.setValueAtTime(
      Math.max(0.0002, peak * profile.sustain),
      Math.max(when + profile.attack + profile.decay, when + d - 0.02)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    const filter = ctx.createBiquadFilter();
    filter.type = profile.bandpass ? 'bandpass' : 'lowpass';
    filter.frequency.value = profile.filter;
    filter.Q.value = profile.q;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Core.clamp((note.midi - 57) / 32, -0.65, 0.65);

    let tail = filter;
    if (profile.drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(profile.drive);
      shaper.oversample = '2x';
      filter.connect(shaper);
      tail = shaper;
    }
    tail.connect(gain);
    gain.connect(panner);
    panner.connect(masterGain);

    const nodes = [gain, filter, panner];
    const lfoNodes = [];

    for (let i = 0; i < profile.osc.length; i++) {
      const [type, ratio, level] = profile.osc[i];
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * ratio;
      if (profile.chorus) osc.detune.value = i === 1 ? profile.chorus : (i === 2 ? -profile.chorus : 0);
      const oscGain = ctx.createGain();
      oscGain.gain.value = level;
      osc.connect(oscGain);
      oscGain.connect(filter);
      nodes.push(osc, oscGain);

      if (profile.vibrato && i === 0) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = profile.vibrato;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = profile.vibratoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);
        lfoNodes.push(lfo, lfoGain);
      }
    }

    if (profile.breath) {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      noise.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 2400;
      noiseFilter.Q.value = 0.7;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = profile.breath;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(filter);
      nodes.push(noise, noiseFilter, noiseGain);
    }

    if (profile.pluck) {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1800;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(profile.pluck * v, when);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(gain);
      nodes.push(noise, noiseFilter, noiseGain);
    }

    finishVoice(nodes.concat(lfoNodes), when, stopAt);
  }

  function playDrum(note, when, isPoly) {
    const ctx = audioCtx;
    if (!ctx) return;
    const midi = note.midi;
    const v = Core.clamp(note.velocity / 127, 0.05, 1);
    const peak = Math.pow(v, 1.05) * (isPoly ? 0.18 : 0.26);
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Core.clamp((midi - 50) / 40, -0.5, 0.5);
    gain.connect(panner);
    panner.connect(masterGain);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.003);

    const nodes = [gain, panner];
    let stopAt = when + 0.35;

    function noiseHit(filterType, frequency, q, decay, level) {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = level;
      noise.connect(filter);
      filter.connect(g);
      g.connect(gain);
      nodes.push(noise, filter, g);
      stopAt = Math.max(stopAt, when + decay);
    }

    function toneHit(type, from, to, decay, level) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(from, when);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), when + decay * 0.75);
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(gain);
      nodes.push(osc, g);
      stopAt = Math.max(stopAt, when + decay);
    }

    if (midi === 35 || midi === 36) {
      toneHit('sine', midi === 35 ? 95 : 120, 42, 0.34, 0.9);
      noiseHit('lowpass', 450, 0.8, 0.06, 0.35);
    } else if (midi === 38 || midi === 40) {
      noiseHit('highpass', 1300, 0.8, 0.20, 0.7);
      toneHit('triangle', 190, 120, 0.16, 0.32);
    } else if (midi === 37) {
      noiseHit('bandpass', 1800, 2, 0.06, 0.5);
    } else if (midi === 39) {
      noiseHit('bandpass', 1200, 1.2, 0.12, 0.45);
    } else if (midi === 42 || midi === 44) {
      noiseHit('highpass', 7000, 0.7, 0.055, 0.45);
    } else if (midi === 46) {
      noiseHit('highpass', 6000, 0.7, 0.32, 0.4);
    } else if ([49, 51, 52, 55, 57, 59].includes(midi)) {
      noiseHit('highpass', 4200, 0.7, 0.95, 0.38);
    } else if ([41, 43, 45, 47, 48, 50].includes(midi)) {
      const base = 210 - Math.max(0, 50 - midi) * 5;
      toneHit('triangle', base, base * 0.55, 0.28, 0.65);
      noiseHit('bandpass', 900, 1.2, 0.10, 0.22);
    } else if (midi >= 60 && midi <= 66) {
      toneHit('sine', 330 - (midi - 60) * 18, 220 - (midi - 60) * 12, 0.22, 0.5);
      noiseHit('bandpass', 1600, 2, 0.08, 0.2);
    } else {
      noiseHit('bandpass', 2200, 1.5, 0.12, 0.35);
    }

    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    finishVoice(nodes, when, stopAt + 0.03);
  }

  // 供离线试听/自动测试使用：把任意 OfflineAudioContext 临时接到当前合成器
  window.__melodyRenderVoice = function (ctx, master, note, timbreIndex, duration, when) {
    const oldCtx = audioCtx;
    const oldMaster = masterGain;
    const oldTimbre = state.timbre;
    audioCtx = ctx;
    masterGain = master;
    state.timbre = timbreIndex;
    try {
      makeVoice(note, when || 0, duration || 0.8, false);
    } finally {
      audioCtx = oldCtx;
      masterGain = oldMaster;
      state.timbre = oldTimbre;
    }
  };

  function ensureAudioBuffer() {
    if (state.audioBuffer) return state.audioBuffer;
    if (!state.samples) return null;
    const ctx = ensureAudioContext();
    const buf = ctx.createBuffer(1, state.samples.length, state.sampleRate);
    buf.copyToChannel(state.samples, 0);
    state.audioBuffer = buf;
    return buf;
  }

  function tickPlayback() {
    if (!state.playing) return;
    const ctx = audioCtx;
    if (!ctx) return;
    const now = ctx.currentTime - state.playStartCtx;
    const pos = state.playFrom + Math.max(0, now);
    const total = state.playMode === 'original' ? state.audioDuration : getTimelineEnd();

    if (pos >= total || !isFinite(total)) {
      stopPlayback(false);
      state.playhead = 0;
      updatePlayheadUI();
      renderWave();
      updateStatus();
      return;
    }

    state.playhead = pos;
    updatePlayheadUI();
    followPlayhead(pos);
    rafId = requestAnimationFrame(tickPlayback);
  }

  function followPlayhead(t) {
    const x = timeToX(t);
    const scroll = els.gridScroll;
    const viewLeft = scroll.scrollLeft;
    const viewRight = viewLeft + scroll.clientWidth;
    if (x > viewRight - 55) {
      scroll.scrollLeft = x - scroll.clientWidth * 0.28;
      updateRange();
    } else if (x < viewLeft - 5) {
      scroll.scrollLeft = Math.max(0, x - 40);
      updateRange();
    }
  }

  function stopPlayback(reset) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    clearInterval(scheduleTimer);
    scheduleTimer = 0;
    scheduleIndex = 0;
    playbackNotes = [];
    if (previewSource) {
      try { previewSource.stop(); } catch (e) { /* already stopped */ }
      try { previewSource.disconnect(); } catch (e) { /* ignore */ }
      previewSource = null;
    }
    if (playbackSource) {
      try { playbackSource.stop(); } catch (e) { /* already stopped */ }
      try { playbackSource.disconnect(); } catch (e) { /* ignore */ }
      playbackSource = null;
    }
    for (const node of activeNodes) {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch (err) {
        // ignore
      }
    }
    activeNodes = [];
    if (originalSource) {
      try {
        originalSource.stop();
        originalSource.disconnect();
      } catch (err) {
        // ignore
      }
      originalSource = null;
    }
    state.playing = false;
    state.playMode = null;
    if (reset) state.playhead = 0;
    updateControls();
    updatePlayheadUI();
    if (state.samples) renderWave();
  }

  function getTimelineEnd() {
    let end = state.origin + state.barDur * Math.max(1, state.measures);
    for (const n of state.notes) end = Math.max(end, n.end);
    return end;
  }

  /* ====================================================================== */
  /* 录音                                                                   */
  /* ====================================================================== */

  async function startRecording() {
    if (state.recording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('当前浏览器不支持麦克风录音，请用 Chrome / Edge 打开', 'error');
      return;
    }
    try {
      ensureAudioContext();
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
      recordChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) recordChunks.push(e.data);
      };
      mediaRecorder.onstop = onRecordingStopped;
      mediaRecorder.start(120);
      state.recording = true;
      recordStartedAt = Date.now();
      els.recordPill.classList.remove('hidden');
      els.recordBtn.classList.add('active');
      updateRecordClock();
      clearInterval(recordTimer);
      recordTimer = setInterval(updateRecordClock, 250);
      showToast('录音中 · 建议在安静环境录一条单音旋律');
    } catch (err) {
      console.error(err);
      showToast('无法打开麦克风：' + (err.message || err.name), 'error');
      stopRecording();
    }
  }

  function updateRecordClock() {
    if (!state.recording) return;
    const sec = Math.floor((Date.now() - recordStartedAt) / 1000);
    els.recordTime.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (err) {
        // ignore
      }
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    state.recording = false;
    clearInterval(recordTimer);
    els.recordPill.classList.add('hidden');
    els.recordBtn.classList.remove('active');
    updateControls();
  }

  async function onRecordingStopped() {
    const blob = new Blob(recordChunks, { type: recordChunks[0] ? recordChunks[0].type : 'audio/webm' });
    recordChunks = [];
    mediaRecorder = null;
    if (!blob.size) {
      showToast('录音为空，请再试一次', 'error');
      return;
    }
    showOverlay('正在读取录音', '解码麦克风录音…');
    await nextPaint();
    try {
      const ctx = ensureAudioContext();
      const array = await blob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(array);
      hideOverlay();
      const stamp = new Date();
      const name = `麦克风录音 ${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}.webm`;
      setAudio(buffer, name, blob);
      showToast('录音已载入，正在识别…');
      setTimeout(analyzeCurrent, 160);
    } catch (err) {
      hideOverlay();
      console.error(err);
      showToast('录音解码失败，请换 Chrome / Edge 再试', 'error');
    }
  }

  /* ====================================================================== */
  /* 导出                                                                   */
  /* ====================================================================== */

  function exportMidi() {
    if (!state.notes.length) return;
    try {
      const bytes = Core.writeMidi(state.notes, {
        bpm: state.bpm,
        beatsPerBar: state.beatsPerBar,
        beatUnit: state.beatUnit,
        division: 480,
        program: TIMBRES[state.timbre].program,
        drum: !!TIMBRES[state.timbre].drum,
        splitParts: state.instrumentTracks.length > 0,
        trackName: state.audioName ? state.audioName.replace(/\.[^.]+$/, '') : 'Melody Scribe',
      });
      const blob = new Blob([bytes], { type: 'audio/midi' });
      downloadBlob(blob, baseName() + '.mid');
      showToast('MIDI 已导出 · 可直接拖进 DAW / 打谱软件', 'success');
    } catch (err) {
      console.error(err);
      showToast('MIDI 导出失败：' + err.message, 'error');
    }
  }

  function exportSourceWav() {
    if (!state.samples) return;
    try {
      let channels = [state.samples];
      let sampleRate = state.sampleRate;
      if (state.audioBuffer) {
        sampleRate = state.audioBuffer.sampleRate;
        channels = [];
        for (let c = 0; c < state.audioBuffer.numberOfChannels; c++) {
          channels.push(state.audioBuffer.getChannelData(c));
        }
      }
      const wav = Core.encodeWavChannels(channels, sampleRate);
      downloadBlob(new Blob([wav], { type: 'audio/wav' }), baseName() + '-原音.wav');
      showToast('完整原音 WAV 已导出 · 未做识别或合成，听感与原音一致', 'success');
    } catch (err) {
      console.error(err);
      showToast('原音 WAV 导出失败：' + err.message, 'error');
    }
  }

  async function exportTranscriptionWav() {
    if (!state.notes.length || state.renderingWav) return;
    if (state.playing) stopPlayback(false);
    state.renderingWav = true;
    updateControls();
    showOverlay('正在渲染转录 WAV', state.notes.length + ' 个音符 · 分段离线合成…');
    await nextPaint();
    try {
      const duration = Math.max(1, state.audioDuration || 0, getTimelineEnd());
      const sampleRate = 44100;
      const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Ctx) throw new Error('当前浏览器不支持离线音频渲染');
      const notes = state.notes.length > 6000
        ? state.notes.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 6000)
        : state.notes;
      const output = new Float32Array(Math.ceil(duration * sampleRate));
      const chunkSeconds = 20;
      const chunkCount = Math.ceil(duration / chunkSeconds);

      for (let c = 0; c < chunkCount; c++) {
        const chunkStart = c * chunkSeconds;
        const chunkEnd = Math.min(duration, chunkStart + chunkSeconds);
        const chunkSamples = Math.ceil((chunkEnd - chunkStart) * sampleRate);
        if (chunkSamples <= 0) continue;
        const offline = new Ctx(1, chunkSamples, sampleRate);
        const master = offline.createGain();
        master.gain.value = 0.8;
        const filter = offline.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 6500;
        const bright = offline.createBiquadFilter();
        bright.type = 'highshelf';
        bright.frequency.value = 3000;
        bright.gain.value = 3;
        const lowCut = offline.createBiquadFilter();
        lowCut.type = 'highpass';
        lowCut.frequency.value = 50;
        lowCut.Q.value = 0.7;
        master.connect(lowCut);
        lowCut.connect(bright);
        bright.connect(filter);
        filter.connect(offline.destination);

        const oldCtx = audioCtx;
        const oldMaster = masterGain;
        const activeStart = activeNodes.length;
        audioCtx = offline;
        masterGain = master;
        try {
          for (const n of notes) {
            // 每个音符只在它起音的块里合成，避免块边界重复触发
            if (n.start < chunkStart || n.start >= chunkEnd) continue;
            const t = Math.max(0, n.start - chunkStart);
            const d = Math.max(0.06, Math.min(n.duration + 0.08, chunkEnd - n.start));
            if (d <= 0) continue;
            makeVoice(n, t, d, true);
          }
        } finally {
          audioCtx = oldCtx;
          masterGain = oldMaster;
          activeNodes.length = activeStart;
        }

        const rendered = await offline.startRendering();
        const data = rendered.getChannelData(0);
        output.set(data, Math.min(output.length, Math.floor(chunkStart * sampleRate)));
        els.overlayText.textContent =
          '转录 WAV ' + Math.round(((c + 1) / chunkCount) * 100) + '% · ' +
          (c + 1) + ' / ' + chunkCount + ' 段';
        await new Promise((r) => setTimeout(r, 0));
      }

      let peak = 0;
      for (let i = 0; i < output.length; i++) {
        const v = Math.abs(output[i]);
        if (v > peak) peak = v;
      }
      if (peak > 1e-6) {
        const scale = 0.95 / peak;
        for (let i = 0; i < output.length; i++) output[i] *= scale;
      }
      const wav = Core.encodeWav(output, sampleRate);
      downloadBlob(
        new Blob([wav], { type: 'audio/wav' }),
        baseName() + '-转录.wav'
      );
      showToast('转录 WAV 已导出 · ' + (duration / 60).toFixed(1) + ' 分钟 · ' + notes.length + ' 音符', 'success');
    } catch (err) {
      console.error(err);
      showToast('转录 WAV 渲染失败：' + err.message, 'error');
    } finally {
      state.renderingWav = false;
      hideOverlay();
      updateControls();
    }
  }

  function exportSourceAudio() {    if (!state.samples) return;
    if (state.sourceBlob) {
      // File/Blob 是载入时的原始对象，直接下载可保证与源文件字节级一致。
      downloadBlob(state.sourceBlob, state.sourceName || state.audioName || '原音');
      showToast('已下载原始文件 · 与载入的音频完全一致', 'success');
      return;
    }
    // 内置示例没有源文件，按当前样本生成完整 WAV。
    try {
      const wav = Core.encodeWav(state.samples, state.sampleRate);
      downloadBlob(new Blob([wav], { type: 'audio/wav' }), baseName() + '-原音.wav');
      showToast('已导出完整原音 WAV', 'success');
    } catch (err) {
      console.error(err);
      showToast('原音导出失败：' + err.message, 'error');
    }
  }

  function exportSnapshot() {
    const positioned = state.notes.map((n) => {
      const pos = Math.max(0, n.start - state.origin);
      const measure = Math.floor(pos / state.barDur + 1e-7) + 1;
      const inBar = pos - (measure - 1) * state.barDur;
      return {
        ...n,
        measure,
        beat: Math.floor(inBar / state.beatDur + 1e-7) + 1,
        division: Math.floor((inBar % state.beatDur) / state.step + 1e-7) + 1,
      };
    });
    const data = {
      app: '旋律抄谱机 Melody Scribe',
      version: '1.0.0',
      readonly: true,
      createdAt: new Date().toISOString(),
      source: state.audioName || null,
      bpm: state.bpm,
      timeSignature: state.beatsPerBar + '/' + state.beatUnit,
      grid: '1/' + state.beatUnit * state.divisions,
      quantized: state.quantize,
      sensitivity: (SENSITIVITY_PRESETS[state.sensitivity - 1] || {}).label || '标准',
      measures: state.measures,
      notes: positioned.map((n) => ({
        id: n.id,
        measure: n.measure,
        beat: n.beat,
        division: n.division,
        start: Number(n.start.toFixed(4)),
        duration: Number(n.duration.toFixed(4)),
        midi: n.midi,
        name: Core.midiToName(n.midi),
        part: n.part || null,
        velocity: n.velocity,
        confidence: n.confidence != null ? Number(n.confidence.toFixed(3)) : null,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, baseName() + '-只读副本.json');
    showToast('只读副本已导出（JSON，包含音符与小节信息）', 'success');
  }

  function baseName() {
    const name = (state.audioName || '未命名旋律').replace(/\.[^.]+$/, '');
    return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  }

  async function convertNcmFile(file) {
    if (!file) return;
    showOverlay('正在解密 NCM', '网易云加密容器 · ' + file.name);
    await nextPaint();
    try {
      const decoded = decodeNcm(await file.arrayBuffer(), (p) => {
        setOverlayProgress(p * 0.9, '解密音频流 ' + Math.round(p * 100) + '%');
      });
      const ext = decoded.format || 'mp3';
      const mime = ext === 'flac' ? 'audio/flac' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
      const name = file.name.replace(/\.ncm$/i, '.' + ext);
      const blob = new Blob([decoded.audio], { type: mime });
      hideOverlay();
      downloadBlob(blob, name);
      showToast('已转换：' + name + ' · 保存到下载文件夹');
    } catch (err) {
      hideOverlay();
      console.error(err);
      showToast('NCM 转换失败：' + err.message, 'error');
    }
  }

  function openExportFolder() {
    if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
      window.chrome.webview.postMessage('openDownloads');
      showToast('已打开下载文件夹');
    } else {
      showToast('导出文件在 Windows「下载」文件夹里，可在资源管理器左侧点击“下载”');
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ====================================================================== */
  /* 杂项                                                                   */
  /* ====================================================================== */

  function showModePrompt(name) {
    if (!els.modePrompt) return;
    if (els.modePromptText) {
      els.modePromptText.textContent = (name ? '已载入：' + name + '。' : '') +
        '选择识别方式后再开始，避免导入后直接按默认引擎跑。';
    }
    els.modePrompt.classList.remove('hidden');
  }

  function hideModePrompt() {
    if (els.modePrompt) els.modePrompt.classList.add('hidden');
  }

  function showEngineGuide() {
    if (els.engineGuide) els.engineGuide.classList.remove('hidden');
  }

  function hideEngineGuide() {
    if (els.engineGuide) els.engineGuide.classList.add('hidden');
  }

  function chooseRecognitionMode(engine) {
    state.recognitionEngine = engine;
    if (els.engineSelect) els.engineSelect.value = engine;
    hideModePrompt();
    setTimeout(analyzeCurrent, 120);
  }

  function showOverlay(title, text) {
    els.overlayTitle.textContent = title;
    els.overlayText.textContent = text;
    els.overlay.classList.remove('hidden');
    if (els.overlayProgress) els.overlayProgress.classList.remove('determinate');
    if (els.overlayBar) els.overlayBar.style.width = '0%';
    if (els.overlayPercent) els.overlayPercent.textContent = '0%';
    if (els.overlayEta) els.overlayEta.textContent = '准备中';
  }

  function setOverlayProgress(ratio, detail) {
    const p = Core.clamp(ratio, 0, 1);
    if (els.overlayProgress) els.overlayProgress.classList.add('determinate');
    if (els.overlayBar) els.overlayBar.style.width = (p * 100).toFixed(1) + '%';
    if (els.overlayPercent) els.overlayPercent.textContent = Math.round(p * 100) + '%';
    if (els.overlayEta) els.overlayEta.textContent = detail || '处理中';
  }

  function setOverlayLoading(detail) {
    if (els.overlayProgress) els.overlayProgress.classList.remove('determinate');
    if (els.overlayBar) els.overlayBar.style.width = '0%';
    if (els.overlayPercent) els.overlayPercent.textContent = '…';
    if (els.overlayEta) els.overlayEta.textContent = detail || '加载中';
  }

  function hideOverlay() {
    els.overlay.classList.add('hidden');
  }

  function showToast(message, type) {
    els.toast.textContent = message;
    els.toast.className = 'toast' + (type ? ' ' + type : '');
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 4600);
  }

  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      labelsKey = '';
      renderAll();
    }, 80);
  }

  function nextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 10)));
    });
  }

  function uid(prefix) {
    return (prefix || 'n') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function formatBpm(bpm) {
    if (!Number.isFinite(bpm)) return '120';
    return Math.abs(bpm - Math.round(bpm)) < 0.05 ? String(Math.round(bpm)) : bpm.toFixed(1);
  }

  function formatDuration(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }
})();




