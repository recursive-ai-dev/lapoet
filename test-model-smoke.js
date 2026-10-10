#!/usr/bin/env node
// Copyright 2025 Recursive AI Devs
//
// AG-TUNE MODEL SMOKE TEST
// Exercises the REAL model classes exported from src/engine.js (not copies):
// training, generation, determinism, checkpoint round-trips (incl. the legacy
// train-lyrics.js format), plus unit checks for the fixed components.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  AGTuneEngine,
  LaggedFibonacciGenerator,
  FloydCycleDetector,
  FFTMeterAnalyzer,
  CYKParser,
  rhymeSimilarity
} from './src/engine.js';
import { UniversalLinguisticEngine } from './src/UniversalLinguisticEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const ok = fn();
    if (ok) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✗ ${name}`);
    }
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name} — threw: ${err.message}`);
  }
}

function loadCorpus() {
  const lyricsDir = path.join(__dirname, 'lyrics');
  const lines = [];
  for (const file of fs.readdirSync(lyricsDir).filter((f) => f.endsWith('.txt'))) {
    const content = fs.readFileSync(path.join(lyricsDir, file), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 10) lines.push(trimmed);
    }
  }
  // A few clean English sentences anchor common-function-word bigrams.
  lines.push(
    'the night is dark and the stars are bright above the silent sea',
    'my heart remembers every shadow in the hollow of the moon',
    'softly the wind carries whispers through the ancient trees',
    'time flows like a river into the endless ocean of the night',
    'love burns eternal in the silence of the soul'
  );
  return lines;
}

console.log('='.repeat(70));
console.log('AG-TUNE MODEL SMOKE TEST (real classes from src/engine.js)');
console.log('='.repeat(70));

// ----------------------------------------------------------------------------
console.log('\n[1] Component regressions\n');

check('LFG: seed 0 no longer degenerates to constant zeros (#17)', () => {
  const rng = new LaggedFibonacciGenerator(0);
  const vals = new Set();
  for (let i = 0; i < 50; i++) {
    const v = rng.next();
    if (!(v >= 0 && v < 1)) return false;
    vals.add(v);
  }
  return vals.size > 40;
});

check('FFT meter: perfect iambic scores high, flat scores zero (#24)', () => {
  const iambic = FFTMeterAnalyzer.analyzeStressPattern([0, 1, 0, 1, 0, 1, 0, 1]);
  const flat = FFTMeterAnalyzer.analyzeStressPattern([0, 0, 0, 0, 0, 0, 0, 0]);
  const chaotic = FFTMeterAnalyzer.analyzeStressPattern([0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0]);
  return iambic > 0.8 && flat === 0 && chaotic < iambic;
});

check('Cycle detector: trailing periodicity, minimal period (#23)', () => {
  const cyc = FloydCycleDetector.detect(['love', 'death', 'love', 'death', 'love', 'death']);
  const no = FloydCycleDetector.detect(['the', 'quick', 'brown', 'fox']);
  const incidental = FloydCycleDetector.detect(['a', 'b', 'a', 'c']);
  return (
    cyc.detected === true &&
    cyc.length === 2 &&
    no.detected === false &&
    incidental.detected === false
  );
});

check('Rhyme similarity: exact > partial > unrelated', () => {
  return (
    rhymeSimilarity('Yt', 'Yt') === 1 &&
    rhymeSimilarity('Yt', 'Qt') < 1 &&
    rhymeSimilarity('Yt', null) === 0
  );
});

check('G2P: diphthong "oy" is one syllable, internal y counts (#27)', () => {
  const ule = new UniversalLinguisticEngine({ rng: () => 0.5 });
  const boy = ule.analyze('boy');
  const system = ule.analyze('system');
  return boy.syllables === 1 && system.syllables === 2;
});

check('G2P: night/light share a rhyme part', () => {
  const ule = new UniversalLinguisticEngine({ rng: () => 0.5 });
  return ule.analyze('night').rhymePart === ule.analyze('light').rhymePart;
});

check('generateStructure returns a capitalized, punctuated sentence (#26)', () => {
  const ule = new UniversalLinguisticEngine({ rng: () => 0.42 });
  const s = ule.generateStructure({ complexity: 2 });
  return typeof s === 'string' && /^[A-Z]/.test(s) && s.endsWith('.');
});

check('CYK: n-ary productions parse, empty input rejected (#25)', () => {
  const ule = new UniversalLinguisticEngine({ rng: () => 0.5 });
  const parser = new CYKParser(ule.getGrammar());
  const valid = parser.parse(['the', 'dark', 'cold', 'night', 'fades']);
  const invalid = parser.parse(['night', 'the']);
  const empty = parser.parse([]);
  return valid === true && invalid === false && empty === false;
});

// ----------------------------------------------------------------------------
console.log('\n[2] End-to-end training + generation\n');

const corpus = loadCorpus();
const engine = new AGTuneEngine(20261010);

check('engine trains on the lyrics corpus', () => {
  const reward = engine.train(corpus, 2);
  return (
    engine.isTrained === true &&
    engine.vocabulary.size > 100 &&
    engine.frequencies.size === engine.vocabulary.size &&
    engine.bigrams.size > 0 &&
    engine.totalTokens > 0 &&
    Number.isFinite(reward)
  );
});

check('emotional space built for the vocabulary (full-dim KPCA)', () => {
  if (engine.emotionalSpace.size === 0) return false;
  const dim = engine.kpca.nComponents;
  for (const vec of engine.emotionalSpace.values()) {
    if (!Array.isArray(vec) || vec.length !== dim) return false;
  }
  return true;
});

check('generatePoem produces finite, non-empty output', () => {
  const result = engine.generatePoem('ghosts in the moonlight', 4, 6);
  if (!Array.isArray(result.poem) || result.poem.length !== 4) return false;
  if (!Number.isFinite(result.reward)) return false;
  const nonEmpty = result.poem.filter((l) => l.trim().length > 0).length;
  return nonEmpty >= 3;
});

check('poem lines are distinct (no beam collapse onto one path)', () => {
  const result = engine.generatePoem('echoes of the hollow moon', 4, 6);
  const unique = new Set(result.poem.map((l) => l.trim()).filter((l) => l.length > 0));
  return unique.size >= 2;
});

check('tokenizer keeps contractions and normalizes curly quotes (#28)', () => {
  const tokens = engine._tokenize("It’s kind of bittersweet, love's fire");
  return (
    tokens.includes("it's") &&
    tokens.includes("love's") &&
    tokens.includes('bittersweet') &&
    !tokens.includes('s')
  );
});

check('generated lines land near the syllable target', () => {
  const res = engine.generateLine('whispers in the dark', 10, 6);
  return res.syllableCount >= 6 && res.syllableCount <= 13 && res.line.length > 0;
});

check('generation is deterministic for a fixed seed (#28, no rng noise term)', () => {
  const a = new AGTuneEngine(777);
  const b = new AGTuneEngine(777);
  a.train(corpus, 1);
  b.train(corpus, 1);
  const pa = a.generatePoem('shadow and light', 3, 5);
  const pb = b.generatePoem('shadow and light', 3, 5);
  return JSON.stringify(pa.poem) === JSON.stringify(pb.poem);
});

check('no NaN in TD weights after training/generation (#12, #16)', () => {
  return engine.valueEstimator.weights.every((w) => Number.isFinite(w));
});

// ----------------------------------------------------------------------------
console.log('\n[3] Checkpoint round-trips\n');

check('v2 checkpoint save → load round-trip preserves generation', () => {
  const data = engine.saveCheckpoint();
  const restored = new AGTuneEngine(1);
  restored.loadCheckpoint(JSON.parse(JSON.stringify(data)));
  if (!restored.isTrained) return false;
  if (restored.vocabulary.size !== engine.vocabulary.size) return false;
  if (restored.bigrams.size !== engine.bigrams.size) return false;
  const res = restored.generateLine('memory of water', 10, 5);
  return res.line.length > 0 && Number.isFinite(res.syllableCount);
});

check('legacy train-lyrics checkpoint loads in the UI engine (#19)', () => {
  const legacy = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'agtune-lyrics-checkpoint.json'), 'utf8')
  );
  if (legacy.version) return false; // sanity: it really is the legacy format
  const restored = new AGTuneEngine(1);
  restored.loadCheckpoint(legacy);
  if (!restored.isTrained) return false;
  if (restored.vocabulary.size !== legacy.vocabulary.length) return false;
  if (restored.totalTokens <= 0) return false;
  const res = restored.generatePoem('ghost of ambition', 2, 5);
  return res.poem.length === 2 && Number.isFinite(res.reward);
});

check('invalid checkpoint is rejected', () => {
  const restored = new AGTuneEngine(1);
  try {
    restored.loadCheckpoint({ nonsense: true });
    return false;
  } catch (e) {
    return /Invalid checkpoint/.test(e.message);
  }
});

// ----------------------------------------------------------------------------
console.log('\n' + '='.repeat(70));
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

process.exit(failed === 0 ? 0 : 1);
