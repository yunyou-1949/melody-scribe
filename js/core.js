/*
 * 旋律抄谱机 · Melody Scribe
 * 离线单音旋律识别核心：YIN 音高检测 + 谱通量起音 + 节拍/小节推断 + MIDI 导出
 *
 * 该文件同时支持浏览器（window.MusicCore）与 Node.js（module.exports），
 * 方便命令行测试与网页共用同一套算法。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MusicCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPS = 1e-12;
  const A4_MIDI = 69;
  const A4_FREQ = 440;

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function midiToFreq(midi) {
    return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
  }

  function freqToMidi(freq) {
    return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
  }

  function midiToName(midi) {
    const m = Math.round(midi);
    const name = NOTE_NAMES[((m % 12) + 12) % 12];
    const octave = Math.floor(m / 12) - 1;
    return name + octave;
  }

  function isBlackKey(midi) {
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    return [1, 3, 6, 8, 10].includes(pc);
  }

  function percentile(values, p) {
    if (!values || values.length === 0) return 0;
    const arr = Array.from(values).sort((a, b) => a - b);
    const idx = clamp((arr.length - 1) * p, 0, arr.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  }

  function median(values) {
    if (!values || values.length === 0) return NaN;
    const arr = Array.from(values).sort((a, b) => a - b);
    const mid = arr.length >> 1;
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  /* ------------------------------------------------------------------ */
  /* 迭代式 radix-2 FFT                                                  */
  /* ------------------------------------------------------------------ */

  function FFT(size) {
    if ((size & (size - 1)) !== 0) throw new Error('FFT size must be a power of two');
    this.size = size;
    this.levels = Math.round(Math.log2(size));
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((2 * Math.PI * i) / size);
    }
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let x = i;
      let r = 0;
      for (let j = 0; j < this.levels; j++) {
        r = (r << 1) | (x & 1);
        x >>= 1;
      }
      this.rev[i] = r;
    }
  }

  FFT.prototype.transform = function (re, im, inverse) {
    const n = this.size;
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    const cos = this.cos;
    const sin = this.sin;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const wr = cos[k];
          const wi = inverse ? sin[k] : -sin[k];
          const a = start + j;
          const b = a + half;
          const xr = re[b];
          const xi = im[b];
          const tr = wr * xr - wi * xi;
          const ti = wr * xi + wi * xr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* 分析：分帧、音高、起音                                               */
  /* ------------------------------------------------------------------ */

  function analyzeAudio(samples, sampleRate, options) {
    const opts = Object.assign(
      {
        frameSize: 2048,
        hop: 512,
        fftSize: 4096,
        minFreq: 70,
        maxFreq: 1400,
        yinThreshold: 0.17,
        onsetSensitivity: 0.5,
        pitchConfidence: 0.52,
        rmsGateScale: 1,
        minNoteDuration: 0.055,
        labelMinFrames: 3,
        maxDuration: 300,
      },
      options || {}
    );

    if (!samples || !samples.length) {
      return emptyResult(0);
    }

    const sr = sampleRate;
    const frameSize = opts.frameSize;
    const hop = opts.hop;
    const fftSize = opts.fftSize;
    const analysisLength = Math.min(
      samples.length,
      Math.floor(opts.maxDuration * sr)
    );

    // 统一音量，避免不同录音电平影响阈值。
    let peak = 0;
    for (let i = 0; i < analysisLength; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    const gain = peak > 1e-6 ? 0.9 / peak : 1;
    const pcm = new Float32Array(analysisLength);
    for (let i = 0; i < analysisLength; i++) pcm[i] = samples[i] * gain;

    const window = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
    }

    const nFrames = Math.max(0, Math.floor((analysisLength - frameSize) / hop) + 1);
    const flux = new Float64Array(nFrames);
    const rms = new Float64Array(nFrames);
    const midiRaw = new Float64Array(nFrames);
    const conf = new Float64Array(nFrames);
    midiRaw.fill(NaN);

    const fft = new FFT(fftSize);
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    const prevLogMag = new Float64Array(fftSize / 2);
    const prefix = new Float64Array(frameSize + 1);
    const cmnd = new Float64Array(Math.min(frameSize - 2, Math.ceil(sr / opts.minFreq) + 1));

    const minLag = Math.max(2, Math.floor(sr / opts.maxFreq));
    const maxLag = Math.min(frameSize - 2, Math.floor(sr / opts.minFreq));
    const halfBins = frameSize / 2;

    for (let f = 0; f < nFrames; f++) {
      const offset = f * hop;

      // 1) 加窗 + 能量前缀
      let energy = 0;
      for (let i = 0; i < frameSize; i++) {
        const x = pcm[offset + i] * window[i];
        re[i] = x;
        im[i] = 0;
        energy += x * x;
        prefix[i + 1] = energy;
      }
      for (let i = frameSize; i < fftSize; i++) {
        re[i] = 0;
        im[i] = 0;
      }

      let rawEnergy = 0;
      for (let i = 0; i < frameSize; i++) {
        const x = pcm[offset + i];
        rawEnergy += x * x;
      }
      rms[f] = Math.sqrt(rawEnergy / frameSize);

      fft.transform(re, im, false);

      // 2) 谱通量（对数幅度正差）
      let fl = 0;
      for (let k = 1; k < halfBins; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const logMag = Math.log1p(mag * 12);
        const d = logMag - prevLogMag[k];
        if (d > 0) fl += d;
        prevLogMag[k] = logMag;
      }
      flux[f] = fl / halfBins;

      // 3) 用功率谱的逆变换求自相关，再走 YIN
      for (let k = 0; k < fftSize; k++) {
        const p = re[k] * re[k] + im[k] * im[k];
        re[k] = p;
        im[k] = 0;
      }
      fft.transform(re, im, true);
      const ac = re;

      // 差分函数 d(tau) = sum_{j<W-tau}(x[j]-x[j+tau])^2
      let running = 0;
      let bestTau = -1;
      let bestValue = 1;
      const limit = Math.min(maxLag, cmnd.length - 1);
      for (let tau = 1; tau <= limit; tau++) {
        const e1 = prefix[frameSize - tau];
        const e2 = prefix[frameSize] - prefix[tau];
        let d = e1 + e2 - 2 * ac[tau];
        if (d < 0) d = 0;
        running += d;
        const c = running > EPS ? (d * tau) / running : 1;
        cmnd[tau] = c;
        if (tau >= minLag && c < bestValue) {
          bestValue = c;
          bestTau = tau;
        }
      }

      if (bestTau > 0 && bestValue <= opts.yinThreshold) {
        let tau = bestTau;
        // 找到第一个低于阈值的局部谷，抑制高八度误判
        for (let t = minLag; t <= limit; t++) {
          if (cmnd[t] < opts.yinThreshold) {
            let q = t;
            while (q + 1 <= limit && cmnd[q + 1] < cmnd[q]) q++;
            tau = q;
            break;
          }
        }
        let refined = tau;
        if (tau > 1 && tau < limit) {
          const a = cmnd[tau - 1];
          const b = cmnd[tau];
          const c = cmnd[tau + 1];
          const denom = a - 2 * b + c;
          if (Math.abs(denom) > 1e-9) {
            const delta = (0.5 * (a - c)) / denom;
            if (delta > -0.5 && delta < 0.5) refined = tau + delta;
          }
        }
        const freq = sr / refined;
        if (freq >= opts.minFreq * 0.95 && freq <= opts.maxFreq * 1.05) {
          midiRaw[f] = freqToMidi(freq);
          conf[f] = clamp(1 - cmnd[tau], 0, 1);
        }
      }
    }

    if (nFrames === 0) {
      return emptyResult(samples.length / sr);
    }

    /* ---------- 音高轨迹平滑 ---------- */
    const smoothMidi = new Float64Array(nFrames);
    smoothMidi.fill(NaN);
    for (let i = 0; i < nFrames; i++) {
      if (!Number.isFinite(midiRaw[i])) continue;
      const vals = [];
      for (let j = Math.max(0, i - 2); j <= Math.min(nFrames - 1, i + 2); j++) {
        if (Number.isFinite(midiRaw[j])) vals.push(midiRaw[j]);
      }
      if (vals.length >= 2) smoothMidi[i] = median(vals);
    }

    /* ---------- 静音门限 ---------- */
    const rmsSorted = Array.from(rms).sort((a, b) => a - b);
    const noise = percentile(rmsSorted, 0.05);
    const loud = percentile(rmsSorted, 0.98);
    // 连续的长音没有“静音段”，此时不能用低百分位当作噪声底，否则会把
    // 整段持续音都门掉。只有明显存在静音簇时才参考噪声底。
    const noiseGate = noise < loud * 0.1 ? noise * 2.5 : 0;
    const rmsGate = Math.max(noiseGate, loud * 0.015, 1e-6) * opts.rmsGateScale;
    const confGate = opts.pitchConfidence;

    /* ---------- 归一化起音包络 ---------- */
    const fluxPeak = Math.max(percentile(flux, 0.995), 1e-8);
    const fluxNorm = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) {
      fluxNorm[i] = clamp(flux[i] / fluxPeak, 0, 1);
    }
    const fluxSmooth = new Float64Array(nFrames);
    for (let i = 0; i < nFrames; i++) {
      const a = fluxNorm[Math.max(0, i - 1)];
      const b = fluxNorm[i];
      const c = fluxNorm[Math.min(nFrames - 1, i + 1)];
      fluxSmooth[i] = (a + 2 * b + c) / 4;
    }

    const fps = sr / hop;
    const onsetPeaks = pickOnsets(fluxSmooth, fps, opts.onsetSensitivity);

    /* ---------- 帧标签 ---------- */
    const labels = new Int16Array(nFrames);
    labels.fill(-9999);
    for (let i = 0; i < nFrames; i++) {
      if (
        Number.isFinite(smoothMidi[i]) &&
        conf[i] >= confGate &&
        rms[i] >= rmsGate
      ) {
        labels[i] = Math.round(smoothMidi[i]);
      }
    }
    cleanLabels(labels, opts.labelMinFrames);

    /* ---------- 连续音高段 ---------- */
    let segments = [];
    let i = 0;
    while (i < nFrames) {
      if (labels[i] < 0) {
        i++;
        continue;
      }
      const start = i;
      const pitch = labels[i];
      while (
        i + 1 < nFrames &&
        (labels[i + 1] === pitch || (labels[i + 1] < 0 && i + 2 < nFrames && labels[i + 2] === pitch))
      ) {
        i++;
      }
      let end = i;
      while (end > start && labels[end] < 0) end--;
      segments.push({ start, end, midi: pitch });
      i++;
    }

    // 合并被极短空隙分开的相同音高
    const merged = [];
    for (const seg of segments) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        prev.midi === seg.midi &&
        (seg.start - prev.end) * (hop / sr) < 0.075
      ) {
        prev.end = seg.end;
      } else {
        merged.push({ ...seg });
      }
    }
    segments = merged;

    // 用强起音点切开同音重复
    const splitSegments = [];
    for (const seg of segments) {
      const cuts = [];
      for (const peak of onsetPeaks) {
        // 只有“能量真的重新冲起来”的起音才切成两个同音；持续长音的
        // 自然衰减会在谱通量上产生小波动，不能当重音。
        let before = 0;
        let after = 0;
        for (let k = Math.max(0, peak.frame - 3); k < peak.frame; k++) before += rms[k];
        before /= Math.max(1, Math.min(3, peak.frame));
        for (let k = peak.frame; k <= Math.min(nFrames - 1, peak.frame + 2); k++) {
          after = Math.max(after, rms[k]);
        }
        if (after < before * 1.12) continue;

        if (
          peak.frame > seg.start + Math.round(0.09 * fps) &&
          peak.frame < seg.end - Math.round(0.06 * fps) &&
          peak.strength > 0.17
        ) {
          // 弱拍位置上的小波动不切
          if (!cuts.length || peak.frame - cuts[cuts.length - 1] > 0.09 * fps) {
            cuts.push(peak.frame);
          }
        }
      }
      let cursor = seg.start;
      for (const cut of cuts) {
        if (cut - cursor >= Math.round(0.05 * fps)) {
          splitSegments.push({
            start: cursor,
            end: Math.max(cursor, cut - 1),
            midi: seg.midi,
          });
          cursor = cut;
        }
      }
      splitSegments.push({ start: cursor, end: seg.end, midi: seg.midi });
    }

    /* ---------- 段 -> 音符 ---------- */
    const frameSec = hop / sr;
    let notes = [];
    for (const seg of splitSegments) {
      let s = seg.start;
      let e = seg.end;
      let segPeak = 0;
      for (let k = s; k <= e; k++) if (rms[k] > segPeak) segPeak = rms[k];
      if (segPeak < rmsGate * 1.1) continue;

      // 去掉起音前 / 收音后的弱帧
      const trimGate = Math.max(rmsGate * 1.15, segPeak * 0.07);
      while (s < e && rms[s] < trimGate) s++;
      while (e > s && rms[e] < trimGate) e--;

      const startTime = Math.max(0, (s * hop + frameSize * 0.5) / sr - 0.006);
      const endTime = Math.min(analysisLength / sr, (e * hop + frameSize * 0.5) / sr + 0.012);
      const duration = endTime - startTime;
      if (duration < opts.minNoteDuration) continue;

      // 音高取中位数，顺带记录音分偏差
      const pitchVals = [];
      for (let k = s; k <= e; k++) {
        if (Number.isFinite(midiRaw[k]) && Math.abs(midiRaw[k] - seg.midi) < 0.7) {
          pitchVals.push(midiRaw[k]);
        }
      }
      const midiFloat = pitchVals.length ? median(pitchVals) : seg.midi;
      const midi = clamp(Math.round(midiFloat), 12, 120);

      // 力度：取该段最响的几个 RMS 帧
      const peaks = [];
      for (let k = s; k <= e; k++) peaks.push(rms[k]);
      peaks.sort((a, b) => b - a);
      const top = peaks.slice(0, Math.max(1, Math.ceil(peaks.length * 0.2)));
      const loudness = top.reduce((a, b) => a + b, 0) / top.length;
      const db = 20 * Math.log10(Math.max(loudness, 1e-7));

      notes.push({
        start: startTime,
        end: endTime,
        duration,
        midi,
        midiFloat,
        cents: Math.round((midiFloat - midi) * 100),
        velocity: 96,
        confidence: conf[Math.min(nFrames - 1, Math.round((s + e) / 2))] || 0,
        db,
      });
    }

    notes = mergeShortNotes(notes, opts.minNoteDuration, 0.045);

    // 将相对响度映射到 MIDI 力度 42..122
    if (notes.length) {
      const dbs = notes.map((n) => n.db);
      let lo = percentile(dbs, 0.08);
      let hi = percentile(dbs, 0.92);
      if (!(hi > lo + 0.8)) {
        lo = Math.min(...dbs) - 1;
        hi = Math.max(...dbs) + 1;
      }
      for (const n of notes) {
        const v = 44 + ((n.db - lo) / (hi - lo)) * 76;
        n.velocity = Math.round(clamp(v, 38, 122));
        delete n.db;
      }
    }

    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);

    /* ---------- 节拍与小节 ---------- */
    const tempo = estimateTempo(fluxSmooth, fps, analysisLength / sr);
    // 单音旋律无法可靠判断“弱起/强拍”，因此以第一个识别到的音作为第 1 小节
    // 的参照；向前让出约 18ms 的检测延迟，让小节的拍点落在音的起音之前。
    const downbeat = notes.length ? Math.max(0, notes[0].start - 0.018) : tempo.phase;

    const result = {
      notes,
      bpm: tempo.bpm,
      confidence: tempo.confidence,
      beatPhase: downbeat,
      onsetPeaks: onsetPeaks.map((p) => ({
        time: p.time,
        strength: p.strength,
      })),
      duration: analysisLength / sr,
      frameRate: fps,
      frameCount: nFrames,
      options: opts,
    };

    if (opts.debug) {
      result._debug = {
        rms,
        flux: fluxSmooth,
        midiRaw,
        smoothMidi,
        conf,
        labels,
        rmsGate,
        confGate,
        hop,
        frameSize,
        sampleRate: sr,
      };
    }

    return result;
  }

  /* ------------------------------------------------------------------ */
  /* 标签清理：短小跳变归并                                               */
  /* ------------------------------------------------------------------ */

  function cleanLabels(labels, minFrames) {
    const n = labels.length;
    const minRun = Math.max(2, minFrames || 3);
    // 1) 先做中值滤波（窗口 3），减少颤音造成的 1 帧抖动
    const copy = Int16Array.from(labels);
    for (let i = 1; i < n - 1; i++) {
      const a = copy[i - 1];
      const b = copy[i];
      const c = copy[i + 1];
      if (a >= 0 && c >= 0 && Math.abs(a - c) <= 1 && b < 0) labels[i] = Math.round((a + c) / 2);
    }

    // 2) 删除短于 3 帧的孤立音高片段
    for (let pass = 0; pass < 2; pass++) {
      let i = 0;
      while (i < n) {
        if (labels[i] < 0) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < n && labels[j + 1] === labels[i]) j++;
        const len = j - i + 1;
        if (len < minRun) {
          const prev = i > 0 ? labels[i - 1] : -9999;
          const next = j + 1 < n ? labels[j + 1] : -9999;
          if (prev === next && prev >= 0) {
            for (let k = i; k <= j; k++) labels[k] = prev;
          } else if (next >= 0) {
            for (let k = i; k <= j; k++) labels[k] = next;
          } else if (prev >= 0) {
            for (let k = i; k <= j; k++) labels[k] = prev;
          } else {
            for (let k = i; k <= j; k++) labels[k] = -9999;
          }
        }
        i = j + 1;
      }
    }
  }

  function mergeShortNotes(notes, minDur, gap) {
    notes.sort((a, b) => a.start - b.start);
    const out = [];
    for (const n of notes) {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.midi === n.midi &&
        n.start - prev.end < gap &&
        (prev.duration < 0.09 || n.duration < 0.09)
      ) {
        prev.end = n.end;
        prev.duration = prev.end - prev.start;
        prev.velocity = Math.max(prev.velocity, n.velocity);
        continue;
      }
      if (n.duration >= minDur) out.push(n);
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 起音峰值                                                            */
  /* ------------------------------------------------------------------ */

  function pickOnsets(env, fps, sensitivity) {
    const n = env.length;
    if (!n) return [];
    const vals = Array.from(env);
    const med = percentile(vals, 0.5);
    const p90 = percentile(vals, 0.9);
    const base = Math.max(0.08, med + (p90 - med) * 0.55);
    const threshold = clamp(base * (1.15 - 0.3 * (sensitivity || 0.5)), 0.055, 0.5);
    const peaks = [];
    for (let i = 1; i < n - 1; i++) {
      const v = env[i];
      if (v < threshold) continue;
      if (v < env[i - 1] || v < env[i + 1]) continue;
      if (v === env[i - 1] && v === env[i + 1]) continue;
      // 局部突出度
      const left = env[Math.max(0, i - 4)];
      const right = env[Math.min(n - 1, i + 4)];
      const prominence = v - Math.max(left, right) * 0.55;
      if (prominence < 0.035) continue;
      const last = peaks[peaks.length - 1];
      if (last && i - last.frame < fps * 0.07) {
        if (v > last.strength) {
          last.frame = i;
          last.time = i / fps;
          last.strength = v;
        }
        continue;
      }
      peaks.push({
        frame: i,
        time: i / fps,
        strength: v,
      });
    }
    return peaks;
  }

  /* ------------------------------------------------------------------ */
  /* 速度 / 拍点 / 小节                                                  */
  /* ------------------------------------------------------------------ */

  function estimateTempo(env, fps, duration) {
    if (!env.length || duration < 1.0) {
      return { bpm: 120, phase: 0, confidence: 0 };
    }

    // 去均值并轻度平滑
    const n = env.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += env[i];
    mean /= n;
    const e = new Float64Array(n);
    for (let i = 0; i < n; i++) e[i] = Math.max(0, env[i] - mean * 0.45);

    const candidates = [];
    const minBpm = 50;
    const maxBpm = 210;
    for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.25) {
      const lag = (60 / bpm) * fps;
      if (lag >= n - 2) continue;
      let sum = 0;
      let count = 0;
      const step = Math.max(1, lag / 60);
      for (let t = 0; t + lag < n; t += step) {
        const idx = t + lag;
        const i0 = Math.floor(idx);
        const frac = idx - i0;
        const v = e[i0] * (1 - frac) + e[Math.min(n - 1, i0 + 1)] * frac;
        sum += e[Math.floor(t)] * v;
        count++;
      }
      if (count < 4) continue;
      const score = sum / count;
      const octaveWeight = Math.exp(
        -0.5 * Math.pow(Math.log2(bpm / 112) / 0.78, 2)
      );
      candidates.push({ bpm, score: score * octaveWeight });
    }
    if (!candidates.length) return { bpm: 120, phase: 0, confidence: 0 };

    let best = candidates[0];
    for (const c of candidates) if (c.score > best.score) best = c;

    // 抛物线细化
    const idx = candidates.indexOf(best);
    if (idx > 0 && idx < candidates.length - 1) {
      const a = candidates[idx - 1].score;
      const b = best.score;
      const c = candidates[idx + 1].score;
      const denom = a - 2 * b + c;
      if (Math.abs(denom) > 1e-12) {
        const delta = (0.5 * (a - c)) / denom;
        if (Math.abs(delta) < 1) best = { bpm: best.bpm + delta * 0.25, score: b };
      }
    }

    let bpm = best.bpm;
    // 低于 55 BPM 的候选通常是“半速”误判，向上折半；60 BPM 的慢歌保留。
    while (bpm < 55) bpm *= 2;
    while (bpm > 200) bpm /= 2;
    bpm = Math.round(bpm * 10) / 10;

    const period = (60 / bpm) * fps;
    const phase = findBeatPhase(e, period);
    const confidence = clamp(best.score / (percentile(candidates.map((c) => c.score), 0.9) + 1e-9), 0, 1);
    return {
      bpm,
      phase: phase / fps,
      confidence,
    };
  }

  function findBeatPhase(env, period) {
    const n = env.length;
    let bestPhase = 0;
    let bestScore = -Infinity;
    const steps = Math.max(8, Math.ceil(period * 4));
    for (let s = 0; s < steps; s++) {
      const phase = (s / steps) * period;
      let score = 0;
      let weight = 1;
      for (let t = phase; t < n; t += period / 2) {
        const idx = Math.floor(t);
        const frac = t - idx;
        const v = env[idx] * (1 - frac) + env[Math.min(n - 1, idx + 1)] * frac;
        score += v * weight;
        weight *= 0.97;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPhase = phase;
      }
    }
    return bestPhase;
  }

  /* ------------------------------------------------------------------ */
  /* 量化 / 分小节                                                       */
  /* ------------------------------------------------------------------ */

  function quantizeNotes(rawNotes, options) {
    const opts = Object.assign(
      {
        bpm: 120,
        beatsPerBar: 4,
        beatUnit: 4,
        divisionsPerBeat: 4,
        origin: 0,
        quantize: true,
        minDuration: 0.08,
      },
      options || {}
    );
    const beatDur = (60 / opts.bpm) * (4 / opts.beatUnit);
    const step = beatDur / opts.divisionsPerBeat;
    const barDur = beatDur * opts.beatsPerBar;
    const origin = opts.origin || 0;

    const notes = rawNotes.map((n, index) => {
      let start = n.start;
      let end = n.end;
      if (opts.quantize) {
        start = origin + Math.round((start - origin) / step) * step;
        end = origin + Math.round((end - origin) / step) * step;
      }
      if (end <= start) end = start + step;
      if (end - start < Math.min(opts.minDuration, step * 0.5)) end = start + step;
      return {
        ...n,
        id: n.id || 'n' + index,
        start: Math.max(0, start),
        end: Math.max(0, end),
        duration: Math.max(0, end - start),
      };
    });

    // 移除同一音高、同一位置完全重复的音符
    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
    const dedup = [];
    for (const n of notes) {
      const prev = dedup[dedup.length - 1];
      if (
        prev &&
        prev.midi === n.midi &&
        Math.abs(prev.start - n.start) < 1e-4
      ) {
        if (n.end > prev.end) {
          prev.end = n.end;
          prev.duration = prev.end - prev.start;
        }
        prev.velocity = Math.max(prev.velocity, n.velocity);
        continue;
      }
      dedup.push(n);
    }

    let maxMeasure = 1;
    for (const n of dedup) {
      const pos = n.start - origin;
      const m = Math.floor(Math.max(0, pos) / barDur + 1e-7) + 1;
      const inBar = Math.max(0, pos) - (m - 1) * barDur;
      n.measure = m;
      n.beat = Math.floor(inBar / beatDur + 1e-7) + 1;
      n.division = Math.floor((inBar % beatDur) / step + 1e-7) + 1;
      n.barBeat = (inBar / beatDur) + 1;
      if (m > maxMeasure) maxMeasure = m;
    }

    return {
      notes: dedup,
      measures: maxMeasure,
      beatDuration: beatDur,
      barDuration: barDur,
      step,
      origin,
    };
  }

  /* ------------------------------------------------------------------ */
  /* MIDI 导出                                                           */
  /* ------------------------------------------------------------------ */

  function varLen(value) {
    let v = Math.max(0, Math.round(value));
    const bytes = [v & 0x7f];
    v >>= 7;
    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    return bytes;
  }

  function textEvent(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function buildTrack(events) {
    const bytes = [];
    let lastTick = 0;
    for (const ev of events) {
      // MIDI 轨道事件使用相对上一个事件的 delta time，而不是绝对 tick。
      // 这里必须做差，否则音符会被排到几小时之后（播放时听起来像没有声音）。
      const delta = Math.max(0, ev.tick - lastTick);
      bytes.push(...varLen(delta), ...ev.data);
      lastTick = Math.max(lastTick, ev.tick);
    }
    bytes.push(...varLen(0), 0xff, 0x2f, 0x00);
    return bytes;
  }

  function trackChunk(bytes) {
    const out = [0x4d, 0x54, 0x72, 0x6b]; // MTrk
    const len = bytes.length;
    out.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
    return out.concat(bytes);
  }

  function writeMidi(notes, options) {
    const opts = Object.assign(
      {
        bpm: 120,
        beatsPerBar: 4,
        beatUnit: 4,
        division: 480,
        program: 27,
        trackName: 'Melody Scribe',
      },
      options || {}
    );
    const beatDur = 60 / opts.bpm;
    const ppq = opts.division;
    const tickOf = (sec) => Math.round((sec / beatDur) * ppq);
    const safeName = (String(opts.trackName || 'Melody Scribe')
      .replace(/[^\x20-\x7E]/g, '')
      .trim() || 'Melody Scribe').slice(0, 40);

    const conductor = [];
    conductor.push({
      tick: 0,
      data: [0xff, 0x03, ...varLenPadded(safeName)],
    });
    const micros = Math.round(60000000 / opts.bpm);
    conductor.push({
      tick: 0,
      data: [
        0xff,
        0x51,
        0x03,
        (micros >> 16) & 0xff,
        (micros >> 8) & 0xff,
        micros & 0xff,
      ],
    });
    const denom = Math.round(Math.log2(opts.beatUnit));
    conductor.push({
      tick: 0,
      data: [0xff, 0x58, 0x04, opts.beatsPerBar, denom, 24, 8],
    });

    const groups = [];
    if (opts.drum) {
      groups.push({
        key: 'drums',
        label: '鼓组',
        program: 0,
        channel: 9,
        notes,
      });
    } else if (opts.splitParts) {
      const defs = [
        { key: 'drums', label: 'Drums', program: 0, channel: 9 },
        { key: 'bass', label: 'Bass', program: opts.program, channel: 0 },
        { key: 'harmony', label: 'Harmony', program: opts.program, channel: 1 },
        { key: 'melody', label: 'Melody', program: opts.program, channel: 2 },
      ];
      for (const def of defs) {
        const groupNotes = notes.filter((n) => {
          let part = n.part || (n.midi <= 50 ? 'bass' : n.midi >= 72 ? 'melody' : 'harmony');
          if (part === 'mid') part = 'harmony';
          if (part === 'high') part = 'melody';
          return part === def.key;
        });
        if (groupNotes.length) groups.push({ ...def, notes: groupNotes });
      }
    }
    if (!groups.length) {
      groups.push({
        key: 'all',
        label: 'Notes',
        program: opts.program,
        channel: 0,
        notes,
      });
    }

    const tracks = groups.map((group) => {
      const track = [];
      track.push({
        tick: 0,
        data: [0xff, 0x03, ...varLenPadded(safeName + ' ' + group.label)],
      });
      track.push({ tick: 0, data: [0xc0 | group.channel, group.program & 0x7f] });
      group.notes.forEach((n, i) => {
        const channel = group.channel;
        const start = Math.max(0, tickOf(n.start));
        const end = Math.max(start + 1, tickOf(n.start + n.duration));
        const vel = clamp(Math.round(n.velocity), 1, 127);
        const pitch = clamp(Math.round(n.midi), 0, 127);
        track.push({ tick: start, data: [0x90 | channel, pitch, vel], order: 1, i });
        track.push({ tick: end, data: [0x80 | channel, pitch, 0], order: 0, i });
      });
      sortEvents(track);
      return track;
    });

    sortEvents(conductor);

    const header = [
      0x4d, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x01,
      0x00, (1 + tracks.length) & 0xff,
      (ppq >> 8) & 0xff, ppq & 0xff,
    ];

    const bytes = header.concat(trackChunk(buildTrack(conductor)));
    for (const track of tracks) bytes.push(...trackChunk(buildTrack(track)));

    return new Uint8Array(bytes);
  }

  function varLenPadded(text) {
    const body = textEvent(text);
    return [...varLen(body.length), ...body];
  }

  function sortEvents(events) {
    events.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      const ao = a.order == null ? -1 : a.order;
      const bo = b.order == null ? -1 : b.order;
      if (ao !== bo) return ao - bo;
      return 0;
    });
  }

  /* ------------------------------------------------------------------ */
  /* 示例旋律（清音电吉他模拟）                                           */
  /* ------------------------------------------------------------------ */

  const DEMO_BPM = 120;
  const DEMO_NOTES = [
    { beat: 0, dur: 1, midi: 64, vel: 82 },
    { beat: 1, dur: 1, midi: 67, vel: 90 },
    { beat: 2, dur: 1, midi: 69, vel: 98 },
    { beat: 3, dur: 1, midi: 71, vel: 112 },
    { beat: 4, dur: 0.5, midi: 69, vel: 86 },
    { beat: 4.5, dur: 0.5, midi: 69, vel: 104 },
    { beat: 5, dur: 1, midi: 67, vel: 88 },
    { beat: 6, dur: 1, midi: 64, vel: 78 },
    { beat: 7, dur: 1, midi: 62, vel: 84 },
    { beat: 8, dur: 1, midi: 60, vel: 78 },
    { beat: 9, dur: 1, midi: 64, vel: 86 },
    { beat: 10, dur: 1, midi: 67, vel: 94 },
    { beat: 11, dur: 1, midi: 64, vel: 80 },
    { beat: 12, dur: 0.5, midi: 62, vel: 82 },
    { beat: 12.5, dur: 0.5, midi: 66, vel: 96 },
    { beat: 13, dur: 1, midi: 69, vel: 104 },
    { beat: 14, dur: 2, midi: 71, vel: 116 },
  ];

  function generateDemo(sampleRate) {
    const sr = sampleRate || 44100;
    const beat = 60 / DEMO_BPM;
    const totalBeats = 16;
    const duration = totalBeats * beat + 1.6;
    const out = new Float32Array(Math.ceil(duration * sr));

    for (let ni = 0; ni < DEMO_NOTES.length; ni++) {
      const n = DEMO_NOTES[ni];
      const start = n.beat * beat + (ni % 3 === 0 ? 0.004 : ni % 3 === 1 ? -0.003 : 0.0);
      const noteDur = n.dur * beat;
      const freq = midiToFreq(n.midi);
      const amp = (n.vel / 127) * 0.4;
      const begin = Math.floor(start * sr);
      const len = Math.ceil((noteDur + 0.9) * sr);
      let phase = 0;
      let noiseState = 12345 + ni * 777;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        if (begin + i >= out.length) break;
        const attack = Math.min(1, t / 0.004);
        const gate = t > noteDur ? Math.max(0, 1 - (t - noteDur) / 0.09) : 1;
        const decay = Math.exp(-t * 2.4);
        const vib = 1 + 0.0022 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.18);
        phase += (2 * Math.PI * freq * vib) / sr;
        const body =
          Math.sin(phase) * 1.0 +
          Math.sin(phase * 2) * 0.42 * Math.exp(-t * 1.2) +
          Math.sin(phase * 3) * 0.21 * Math.exp(-t * 2.0) +
          Math.sin(phase * 4) * 0.1 * Math.exp(-t * 3.0);
        noiseState = (noiseState * 1103515245 + 12345) & 0x7fffffff;
        const noise = ((noiseState / 0x7fffffff) * 2 - 1) * Math.exp(-t * 55) * 0.14;
        out[begin + i] += (body * 0.7 + noise) * amp * attack * gate * decay;
      }
    }

    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.92;

    return {
      samples: out,
      sampleRate: sr,
      bpm: DEMO_BPM,
      beatsPerBar: 4,
      duration,
      notes: DEMO_NOTES,
    };
  }

  /* ------------------------------------------------------------------ */
  /* WAV 编码（示例下载 / 测试）                                          */
  /* ------------------------------------------------------------------ */

  function encodeWav(samples, sampleRate) {
    return encodeWavChannels([samples], sampleRate);
  }

  function encodeWavChannels(channels, sampleRate) {
    if (!channels || !channels.length) throw new Error('no audio channels');
    const nChannels = channels.length;
    const n = channels[0].length;
    const buffer = new ArrayBuffer(44 + n * nChannels * 2);
    const view = new DataView(buffer);
    const writeStr = (off, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + n * nChannels * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, nChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * nChannels * 2, true);
    view.setUint16(32, nChannels * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, n * nChannels * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nChannels; c++) {
        const s = clamp(channels[c][i], -1, 1);
        view.setInt16(off, Math.round(s * 32767), true);
        off += 2;
      }
    }
    return new Uint8Array(buffer);
  }

  function emptyResult(duration) {
    return {
      notes: [],
      bpm: 120,
      confidence: 0,
      beatPhase: 0,
      onsetPeaks: [],
      duration,
      frameRate: 0,
      frameCount: 0,
    };
  }

  return {
    analyzeAudio,
    quantizeNotes,
    writeMidi,
    generateDemo,
    encodeWav,
    encodeWavChannels,
    estimateTempo,
    midiToFreq,
    freqToMidi,
    midiToName,
    isBlackKey,
    percentile,
    median,
    clamp,
    DEMO_BPM,
    DEMO_NOTES,
  };
});

