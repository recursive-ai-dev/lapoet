// Copyright 2025
// Damien Davison & Michael Maillet & Sacha Davison
// Recursive AI Devs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ============================================================================
// AG-TUNE MODEL CORE
// Pure-JS module (no JSX / no React) so the model can be imported and tested
// directly under Node. The React UI in App.jsx imports AGTuneEngine from here.
// See IMPROVEMENTS.md for the audit that produced this revision.
// ============================================================================

import { UniversalLinguisticEngine } from './UniversalLinguisticEngine.js';

// ----------------------------------------------------------------------------
// Shared utilities
// ----------------------------------------------------------------------------

export const hashSeedString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * Graded rhyme similarity between two rhyme parts (phoneme strings).
 * 1 = identical, otherwise fraction of shared suffix.
 */
export const rhymeSimilarity = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const minLen = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= minLen; i++) {
    if (a.slice(-i) === b.slice(-i)) shared = i;
    else break;
  }
  return shared / Math.max(a.length, b.length);
};

// ----------------------------------------------------------------------------
// Kernel PCA (improvements #3, #4, #5, #6, #7, #8)
// ----------------------------------------------------------------------------

/**
 * Kernel PCA for Non-linear Theme Embedding
 * Transforms word embeddings into emotional/thematic space using polynomial kernel.
 */
export class KernelPCA {
  constructor(nComponents = 12, degree = 3, rng = Math.random, options = {}) {
    this.nComponents = nComponents;
    this.degree = degree;
    this.maxBasisSamples = options.maxBasisSamples ?? 512;
    this.eigenvectors = null;
    this.eigenvalues = null;
    this.alphas = null;       // dual coefficients v / sqrt(lambda) (#3)
    this.X_fit = null;
    this._rowMeans = null;    // column means of the training kernel matrix (#4)
    this._grandMean = 0;
    this.rng = rng;
  }

  /**
   * Polynomial kernel computation: K(x,y) = (cos(x,y) + 1)^d
   * Inputs are cosine-normalized so the kernel stays bounded regardless of a
   * word's raw embedding magnitude/frequency.
   */
  _polynomialKernel(x, y) {
    const normX = Math.sqrt(x.reduce((sum, xi) => sum + xi * xi, 0)) || 1;
    const normY = Math.sqrt(y.reduce((sum, yi) => sum + yi * yi, 0)) || 1;
    const dotProduct = x.reduce((sum, xi, i) => sum + (xi / normX) * ((y[i] || 0) / normY), 0);
    return Math.pow(dotProduct + 1, this.degree);
  }

  /**
   * Centers the kernel matrix via row/column mean subtraction
   * K_centered = K - 1_n*K - K*1_n + 1_n*K*1_n
   * Also stores the column means and grand mean so that out-of-sample rows
   * can be centered consistently in transform() (#4).
   */
  _centerKernelMatrix(K) {
    const n = K.length;
    const rowMeans = new Array(n).fill(0);
    const colMeans = new Array(n).fill(0);
    let totalMean = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        rowMeans[i] += K[i][j];
        colMeans[j] += K[i][j];
        totalMean += K[i][j];
      }
    }

    for (let i = 0; i < n; i++) {
      rowMeans[i] /= n;
      colMeans[i] /= n;
    }
    totalMean /= n * n;

    const centered = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centered[i][j] = K[i][j] - rowMeans[i] - colMeans[j] + totalMean;
      }
    }

    this._rowMeans = colMeans;
    this._grandMean = totalMean;
    return centered;
  }

  /** Recompute centering statistics when they were not persisted (checkpoints). */
  _ensureCenteringStats() {
    if (!this.X_fit || this.X_fit.length === 0) return;
    if (this._rowMeans && this._rowMeans.length === this.X_fit.length) return;
    const n = this.X_fit.length;
    const colMeans = new Array(n).fill(0);
    let total = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const k = this._polynomialKernel(this.X_fit[i], this.X_fit[j]);
        colMeans[j] += k;
        total += k;
        if (i !== j) {
          colMeans[i] += k;
          total += k;
        }
      }
    }
    for (let j = 0; j < n; j++) colMeans[j] /= n;
    this._rowMeans = colMeans;
    this._grandMean = total / (n * n);
  }

  _randomUnitVector(n) {
    const v = new Array(n);
    for (let i = 0; i < n; i++) v[i] = this.rng() - 0.5;
    return v;
  }

  /**
   * Power iteration eigenvalue decomposition for top k eigenvectors (#5, #6).
   * - Re-samples when the deflated start vector collapses to ~0.
   * - Re-deflates after every multiply (floating-point drift otherwise
   *   reintroduces the dominant eigenvector).
   * - Early-stops when the Rayleigh quotient stabilizes.
   * - Skips numerically degenerate components; sorts descending.
   */
  _eigenDecomposition(matrix, maxIter = 100, tol = 1e-8) {
    const n = matrix.length;
    const eigenvectors = [];
    const eigenvalues = [];

    const deflate = (v) => {
      for (let i = 0; i < eigenvectors.length; i++) {
        const dot = v.reduce((sum, vi, idx) => sum + vi * eigenvectors[i][idx], 0);
        v = v.map((vi, idx) => vi - dot * eigenvectors[i][idx]);
      }
      return v;
    };

    const normOf = (v) => Math.sqrt(v.reduce((sum, vi) => sum + vi * vi, 0));

    const targetComponents = Math.min(this.nComponents, n);
    for (let k = 0; k < targetComponents; k++) {
      // Find a usable start vector inside the remaining subspace (#5).
      let v = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const cand = deflate(this._randomUnitVector(n));
        const nrm = normOf(cand);
        if (nrm > 1e-8) {
          v = cand.map((vi) => vi / nrm);
          break;
        }
      }
      if (!v) break; // residual subspace is numerically empty

      let eigenvalue = 0;
      let prev = Infinity;
      for (let iter = 0; iter < maxIter; iter++) {
        const newV = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          const row = matrix[i];
          let acc = 0;
          for (let j = 0; j < n; j++) acc += row[j] * v[j];
          newV[i] = acc;
        }
        const dv = deflate(newV);
        eigenvalue = v.reduce((sum, vi, idx) => sum + vi * dv[idx], 0);
        const nrm = normOf(dv);
        if (nrm < 1e-12) {
          v = null;
          eigenvalue = 0;
          break;
        }
        v = dv.map((vi) => vi / nrm);
        if (Math.abs(eigenvalue - prev) <= tol * Math.max(1, Math.abs(eigenvalue))) break; // #6
        prev = eigenvalue;
      }

      // Centered kernel matrices are PSD; stop once nothing meaningful is left.
      if (!v || eigenvalue <= 1e-9) break;
      eigenvectors.push(v);
      eigenvalues.push(eigenvalue);
    }

    // Explicit descending order by eigenvalue (#5).
    const order = eigenvalues.map((val, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
    return {
      eigenvectors: order.map((i) => eigenvectors[i]),
      eigenvalues: order.map((i) => eigenvalues[i])
    };
  }

  _rebuildAlphas() {
    if (!Array.isArray(this.eigenvectors) || !Array.isArray(this.eigenvalues)) {
      this.alphas = [];
      return;
    }
    this.alphas = this.eigenvectors.map((v, k) => {
      const lambda = this.eigenvalues[k];
      const scale = Number.isFinite(lambda) && lambda > 1e-10 ? 1 / Math.sqrt(lambda) : 0;
      return v.map((vi) => vi * scale);
    });
  }

  /**
   * Fit Kernel PCA to training data.
   * The basis is capped at a stratified subsample for large vocabularies (#7c):
   * ordering by frequency means every frequency band stays represented.
   */
  fit(X) {
    if (!Array.isArray(X) || X.length === 0) {
      throw new Error('KernelPCA.fit requires at least one sample');
    }

    let basisX = X;
    if (X.length > this.maxBasisSamples) {
      const step = X.length / this.maxBasisSamples;
      basisX = [];
      for (let k = 0; k < this.maxBasisSamples; k++) {
        basisX.push(X[Math.floor(k * step)]);
      }
    }

    this.X_fit = basisX;
    const n = basisX.length;

    // Kernel matrix — symmetric, so only compute the upper triangle (#7a).
    const K = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const kval = this._polynomialKernel(basisX[i], basisX[j]);
        K[i][j] = kval;
        K[j][i] = kval;
      }
    }

    const K_centered = this._centerKernelMatrix(K);
    const { eigenvectors, eigenvalues } = this._eigenDecomposition(K_centered);

    this.eigenvectors = eigenvectors;
    this.eigenvalues = eigenvalues;
    this._rebuildAlphas(); // #3
  }

  /**
   * Transform data into kernel space using centered kernel rows (#4)
   * and eigenvalue-normalized dual coefficients (#3).
   */
  transform(X) {
    if (!this.X_fit || !this.alphas || this.alphas.length === 0) {
      throw new Error('KernelPCA.transform called before fit');
    }
    this._ensureCenteringStats();

    const nFit = this.X_fit.length;
    const nComp = Math.min(this.nComponents, this.alphas.length);
    const result = Array.from({ length: X.length }, () => new Array(this.nComponents).fill(0));

    for (let i = 0; i < X.length; i++) {
      const k = new Array(nFit);
      let sum = 0;
      for (let j = 0; j < nFit; j++) {
        k[j] = this._polynomialKernel(X[i], this.X_fit[j]);
        sum += k[j];
      }
      const newRowMean = sum / nFit;

      for (let c = 0; c < nComp; c++) {
        const alpha = this.alphas[c];
        let acc = 0;
        for (let j = 0; j < nFit; j++) {
          acc += (k[j] - newRowMean - this._rowMeans[j] + this._grandMean) * alpha[j];
        }
        result[i][c] = acc;
      }
    }

    return result;
  }
}

// ----------------------------------------------------------------------------
// TD(λ) Value Estimator (improvements #15, #16)
// ----------------------------------------------------------------------------

/**
 * Temporal Difference Value Estimator (TD-λ)
 * Estimates aesthetic value of poetic states for reinforcement learning.
 *
 * Feature layout is pinned to the emotional-space dimensionality (#15):
 * [ eSpaceTraj mean (nComponents) , meter, rhyme, novelty, lineCount, theme ].
 */
export class TDValueEstimator {
  constructor(nComponents = 12, alpha = 0.01, gamma = 0.95, lambda = 0.8, rng = Math.random) {
    // Non-cryptographic RNG allows deterministic seeding when provided.
    this.nComponents = nComponents;
    this.nFeatures = nComponents + 5;
    this.weights = Array(this.nFeatures).fill(0).map(() => rng() * 0.01);
    this.alpha = alpha;
    this.gamma = gamma;
    this.lambda = lambda;
    this.eligibility = Array(this.nFeatures).fill(0);
  }

  /**
   * Extract feature vector from poetic state.
   * The emotional trajectory block is always exactly nComponents wide so the
   * scalar features land on stable indices regardless of checkpoint shape (#15).
   */
  _extractFeatures(state) {
    const dim = this.nComponents;
    const features = new Array(this.nFeatures).fill(0);

    if (!state || !Array.isArray(state.eSpaceTraj) || state.eSpaceTraj.length === 0) {
      return features;
    }

    for (const vec of state.eSpaceTraj) {
      if (!Array.isArray(vec)) continue;
      for (let i = 0; i < dim; i++) {
        const v = vec[i];
        if (Number.isFinite(v)) features[i] += v;
      }
    }
    for (let i = 0; i < dim; i++) features[i] /= state.eSpaceTraj.length;

    features[dim] = Number.isFinite(state.meterScore) ? state.meterScore : 0;
    features[dim + 1] = Number.isFinite(state.rhymeConsistency) ? state.rhymeConsistency : 0;
    features[dim + 2] = Number.isFinite(state.novelty) ? state.novelty : 0;
    features[dim + 3] = Number.isFinite(state.lineCount) ? state.lineCount / 100 : 0;
    features[dim + 4] = Number.isFinite(state.themeCoherence) ? state.themeCoherence : 0;
    return features;
  }

  /**
   * Estimate state value V(s) = w·φ(s)
   */
  estimate(state) {
    const features = this._extractFeatures(state);
    return features.reduce((sum, f, i) => sum + f * this.weights[i], 0);
  }

  /**
   * Update weights using TD(λ): Δw = αδe, where δ = r + γV(s') - V(s).
   * Guards against non-finite rewards/errors corrupting the weights (#16).
   */
  update(state, reward, nextState, done) {
    if (!Number.isFinite(reward)) return 0;

    const phi = this._extractFeatures(state);
    const phiNext = done ? Array(this.nFeatures).fill(0) : this._extractFeatures(nextState);

    const v = phi.reduce((sum, f, i) => sum + f * this.weights[i], 0);
    const vNext = phiNext.reduce((sum, f, i) => sum + f * this.weights[i], 0);

    const tdError = reward + (done ? 0 : this.gamma * vNext) - v;
    if (!Number.isFinite(tdError)) return 0;

    this.eligibility = this.eligibility.map((e, i) => this.gamma * this.lambda * e + phi[i]);
    this.weights = this.weights.map((w, i) => w + this.alpha * tdError * this.eligibility[i]);

    if (done) this.eligibility.fill(0);
    return tdError;
  }
}

// ----------------------------------------------------------------------------
// Lagged Fibonacci Generator (improvement #17)
// ----------------------------------------------------------------------------

const LFG_MODULUS = 2147483647; // 2^31 - 1

/**
 * Lagged Fibonacci Generator (LFG)
 * High-quality pseudo-random number generator for stochastic generation.
 */
export class LaggedFibonacciGenerator {
  constructor(seed = Date.now()) {
    this.state = Array(55).fill(0);
    this.index1 = 0;
    this.index2 = 24;
    this._initialize(seed);
  }

  /**
   * Initialize state using Park-Miller LCG.
   * The seed must be normalized into [1, LFG_MODULUS-1]: seeds that are
   * multiples of the modulus (including 0) would otherwise produce an
   * all-zero state and next() === 0 forever (#17).
   */
  _initialize(seed) {
    let s = Math.floor(Number(seed));
    if (!Number.isFinite(s)) s = 123456789;
    s = ((s % LFG_MODULUS) + LFG_MODULUS) % LFG_MODULUS;
    if (s === 0) s = 42;
    for (let i = 0; i < 55; i++) {
      s = (s * 48271) % LFG_MODULUS;
      this.state[i] = s;
    }
  }

  /**
   * Generate next random number in [0, 1)
   */
  next() {
    const result = (this.state[this.index1] + this.state[this.index2]) % LFG_MODULUS;
    this.state[this.index1] = result;
    this.index1 = (this.index1 + 1) % 55;
    this.index2 = (this.index2 + 1) % 55;
    return result / LFG_MODULUS;
  }
}

// ----------------------------------------------------------------------------
// Rete constraint engine (improvement #22)
// ----------------------------------------------------------------------------

/**
 * Rete Algorithm for Constraint Checking
 * Forward-chaining rule engine for poetic constraints. Conditions are shared
 * alpha nodes (deduped by key+test) whose results are memoized per evaluation,
 * which is what makes this an alpha network instead of a flat loop (#22).
 */
export class ReteEngine {
  constructor() {
    this.alphaNodes = [];
    this.rules = [];
    this._nextAlphaId = 0;
  }

  /**
   * Add production rule to network.
   * Rule: { name, conditions: [{key, test}], action: function }
   * Conditions determine applicability; the action returns pass/fail.
   */
  addRule(name, conditions, action) {
    const ruleConditions = conditions.map((cond) => {
      let node = this.alphaNodes.find((n) => n.key === cond.key && n.test === cond.test);
      if (!node) {
        node = { id: this._nextAlphaId++, key: cond.key, test: cond.test };
        this.alphaNodes.push(node);
      }
      return node;
    });
    this.rules.push({ name, conditions: ruleConditions, action });
  }

  /**
   * Evaluate facts against all rules; returns the rules whose applicability
   * conditions match. Alpha-node results are memoized for this evaluation.
   */
  evaluate(facts) {
    const memo = new Map();
    const matches = [];

    for (const rule of this.rules) {
      let allMatch = true;
      for (const node of rule.conditions) {
        const fact = facts[node.key];
        if (fact === undefined) {
          allMatch = false;
          break;
        }
        let ok = memo.get(node.id);
        if (ok === undefined) {
          ok = node.test(fact);
          memo.set(node.id, ok);
        }
        if (!ok) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) matches.push(rule);
    }

    return matches;
  }
}

// ----------------------------------------------------------------------------
// Repetition detector (improvement #23)
// ----------------------------------------------------------------------------

/**
 * Repetition detection for token sequences.
 * Detects when the tail of the sequence is periodic: the smallest period p
 * such that the last 2p tokens form two full repetitions. This replaces the
 * previous tortoise/hare token-equality heuristic, which produced false
 * positives on incidental repeats and miscomputed cycle lengths (#23).
 */
export class FloydCycleDetector {
  static detect(sequence, maxLookback = 15) {
    if (!Array.isArray(sequence) || sequence.length < 4) {
      return { detected: false, length: 0 };
    }

    const tokens = sequence.slice(-maxLookback).map((t) => (t && typeof t === 'object' ? t.token : t));
    const n = tokens.length;

    for (let p = 1; p <= Math.floor(n / 2); p++) {
      let periodic = true;
      for (let i = n - p; i < n; i++) {
        if (tokens[i] !== tokens[i - p]) {
          periodic = false;
          break;
        }
      }
      if (periodic) {
        return { detected: true, length: p };
      }
    }

    return { detected: false, length: 0 };
  }
}

// ----------------------------------------------------------------------------
// CYK parser (improvement #25)
// ----------------------------------------------------------------------------

/**
 * CYK Parser for Structural Validation.
 * Bottom-up recognizer supporting terminal productions and n-ary right-hand
 * sides (#25): productions with more than two symbols are handled with a
 * span-splitting dynamic program instead of being silently dropped.
 */
export class CYKParser {
  constructor(grammar) {
    this.grammar = grammar;
    this.nonTerminals = new Set(Object.keys(grammar));
    this.terminalMap = new Map(); // non-terminal -> Set of terminal words
    this.productions = new Map(); // non-terminal -> [ [symbols...], ... ] (length >= 2)
    this.unitProductions = new Map(); // non-terminal -> [single-symbol targets]

    for (const [nt, prods] of Object.entries(grammar)) {
      if (!Array.isArray(prods)) continue;
      for (const p of prods) {
        if (typeof p === 'string') {
          if (!this.terminalMap.has(nt)) this.terminalMap.set(nt, new Set());
          this.terminalMap.get(nt).add(p);
        } else if (Array.isArray(p) && p.length >= 2 && p.every((s) => typeof s === 'string')) {
          if (!this.productions.has(nt)) this.productions.set(nt, []);
          this.productions.get(nt).push(p);
        } else if (Array.isArray(p) && p.length === 1 && this.nonTerminals.has(p[0])) {
          if (!this.unitProductions.has(nt)) this.unitProductions.set(nt, []);
          this.unitProductions.get(nt).push(p[0]);
        }
      }
    }
  }

  _initTable(n) {
    return Array.from({ length: n }, () => Array.from({ length: n }, () => new Set()));
  }

  /** Close a chart cell under unit productions (A -> B) to a fixpoint. */
  _applyUnitClosure(table, i, j) {
    if (this.unitProductions.size === 0) return;
    let changed = true;
    while (changed) {
      changed = false;
      for (const [lhs, targets] of this.unitProductions) {
        if (table[i][j].has(lhs)) continue;
        for (const t of targets) {
          if (table[i][j].has(t)) {
            table[i][j].add(lhs);
            changed = true;
            break;
          }
        }
      }
    }
  }

  /** Can span [i, j] derive the symbol sequence rhs? (span-splitting DP) */
  _canDerive(table, i, j, rhs) {
    if (rhs.length === 2) {
      for (let k = i; k < j; k++) {
        if (table[i][k].has(rhs[0]) && table[k + 1][j].has(rhs[1])) return true;
      }
      return false;
    }

    // frontier = set of start positions reachable after consuming symbols so far
    let frontier = [i];
    for (const sym of rhs) {
      const next = new Set();
      for (const start of frontier) {
        for (let end = start; end <= j; end++) {
          if (table[start][end].has(sym)) next.add(end + 1);
        }
      }
      if (next.size === 0) return false;
      frontier = Array.from(next);
    }
    return frontier.includes(j + 1);
  }

  /**
   * Parse token sequence against grammar.
   * Returns true if valid sentence structure. Empty input is invalid (#25).
   */
  parse(tokens) {
    if (!Array.isArray(tokens)) return false;
    const n = tokens.length;
    if (n === 0) return false;

    const table = this._initTable(n);

    for (let i = 0; i < n; i++) {
      for (const [nt, words] of this.terminalMap) {
        if (words.has(tokens[i])) table[i][i].add(nt);
      }
      this._applyUnitClosure(table, i, i);
    }

    for (let len = 2; len <= n; len++) {
      for (let i = 0; i + len <= n; i++) {
        const j = i + len - 1;
        for (const [nt, rhsList] of this.productions) {
          if (table[i][j].has(nt)) continue;
          for (const rhs of rhsList) {
            if (this._canDerive(table, i, j, rhs)) {
              table[i][j].add(nt);
              break;
            }
          }
        }
        this._applyUnitClosure(table, i, j);
      }
    }

    return table[0][n - 1].has('S'); // S = start symbol
  }
}

// ----------------------------------------------------------------------------
// FFT Meter Analyzer (improvement #24)
// ----------------------------------------------------------------------------

/**
 * FFT Meter Analyzer for Rhythmic Structure
 * Uses Fast Fourier Transform to analyze stress patterns.
 *
 * Fixed spectral scoring (#24):
 *  - mean (DC) removal so flat/constant signals do not dominate bin 0,
 *  - the Nyquist bin is included — a perfect alternating pattern peaks at
 *    exactly n/2, which the old `slice(0, n/2)` dropped,
 *  - the target bin is n / period (not the raw pattern length),
 *  - score = spectral energy concentration around the target bin.
 */
export class FFTMeterAnalyzer {
  static analyzeStressPattern(stresses, targetPattern = [0, 1]) {
    if (!Array.isArray(stresses) || stresses.length < targetPattern.length * 2) return 0;

    const signal = stresses.map((s) => (Number.isFinite(Number(s)) ? Number(s) : 0));
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;

    // Pad to power of 2 for FFT; remove DC first.
    const n = Math.pow(2, Math.ceil(Math.log2(signal.length)));
    const padded = new Array(n).fill(0);
    for (let i = 0; i < signal.length; i++) padded[i] = signal[i] - mean;

    const fft = this._fft(padded);

    // Energy in bins 1..n/2 (skip DC bin 0, INCLUDE Nyquist bin n/2).
    let totalEnergy = 0;
    for (let k = 1; k <= n / 2; k++) {
      const c = fft[k];
      totalEnergy += c[0] * c[0] + c[1] * c[1];
    }
    if (totalEnergy <= 1e-12) return 0; // flat — no rhythm at all

    const period = Math.max(1, targetPattern.length);
    const targetBin = Math.min(Math.max(Math.round(n / period), 1), n / 2);

    let targetEnergy = 0;
    for (const k of [targetBin - 1, targetBin, targetBin + 1]) {
      if (k >= 1 && k <= n / 2) {
        const c = fft[k];
        targetEnergy += c[0] * c[0] + c[1] * c[1];
      }
    }

    return Math.min(1, targetEnergy / totalEnergy);
  }

  /**
   * Cooley-Tukey FFT algorithm
   */
  static _fft(signal) {
    const n = signal.length;
    if (n === 1) return [[signal[0], 0]];

    const even = this._fft(signal.filter((_, i) => i % 2 === 0));
    const odd = this._fft(signal.filter((_, i) => i % 2 === 1));

    const result = Array(n).fill().map(() => [0, 0]);
    for (let k = 0; k < n / 2; k++) {
      const angle = (-2 * Math.PI * k) / n;
      const t = [
        Math.cos(angle) * odd[k][0] - Math.sin(angle) * odd[k][1],
        Math.cos(angle) * odd[k][1] + Math.sin(angle) * odd[k][0]
      ];

      result[k] = [even[k][0] + t[0], even[k][1] + t[1]];
      result[k + n / 2] = [even[k][0] - t[0], even[k][1] - t[1]];
    }

    return result;
  }
}

// ----------------------------------------------------------------------------
// MAIN POETRY GENERATION ENGINE
// ----------------------------------------------------------------------------

const RHYME_ACCEPT_THRESHOLD = 0.5;
const SYLLABLE_TOLERANCE = 2;
const EMBEDDING_DIM = 64;
const PRIOR_TEMPERATURE = 0.5; // flattens the raw MLE prior (<1 = less peaked)

/**
 * Aesthetic-Governed Transformative Engine (AG-TUNE)
 * Orchestrates all algorithms for multi-objective poetry generation.
 */
export class AGTuneEngine {
  constructor(seed = Date.now()) {
    this.rng = new LaggedFibonacciGenerator(seed);
    const rng = () => this.rng.next();
    this.kpca = new KernelPCA(12, 3, rng);
    this.valueEstimator = new TDValueEstimator(this.kpca.nComponents, 0.01, 0.95, 0.8, rng);
    this.rete = new ReteEngine();
    this.ule = new UniversalLinguisticEngine({ rng: this.rng }); // Integration of Production-Grade Logic
    this.parser = new CYKParser(this.ule.getGrammar());
    this.vocabulary = new Set();
    this.frequencies = new Map();   // word -> corpus count (#10)
    this.bigrams = new Map();       // "a b" -> corpus count (#14)
    this.totalTokens = 0;
    this.embeddingDim = EMBEDDING_DIM;
    this.embeddings = new Map();
    this.emotionalSpace = new Map();
    this.maxKernelWords = 2500; // cap to keep kernel matrix manageable
    this.lastCorpusSignature = null;
    this.isTrained = false;
    this._vocabCache = null;
    this._analysisCache = new Map();
    this._initializeReteRules();
  }

  /**
   * Initialize Rete constraint checking rules.
   * Conditions mark applicability; actions return pass/fail (#20, #21).
   */
  _initializeReteRules() {
    // Rhyme constraint: applies whenever a rhyme target exists; passes on
    // graded phonetic similarity (not only exact rhyme-part equality).
    this.rete.addRule('rhymeCheck', [
      { key: 'lastWord', test: (w) => typeof w === 'string' && w.length > 0 },
      { key: 'rhymeTarget', test: (t) => typeof t === 'string' && t.length > 0 }
    ], (facts) => {
      const a = this._analysis(facts.lastWord);
      const b = this._analysis(facts.rhymeTarget);
      return rhymeSimilarity(a.rhymePart, b.rhymePart) >= RHYME_ACCEPT_THRESHOLD;
    });

    // Syllable budget: enforced at line end, relative to the requested target
    // instead of a hardcoded 8–10 window (#21).
    this.rete.addRule('syllableLimit', [
      { key: 'atLineEnd', test: (v) => v === true },
      { key: 'syllableCount', test: (n) => Number.isFinite(n) },
      { key: 'targetSyllables', test: (n) => Number.isFinite(n) }
    ], (facts) => Math.abs(facts.syllableCount - facts.targetSyllables) <= SYLLABLE_TOLERANCE);

    // Repetition avoidance: the final word must not repeat either of the
    // two preceding words.
    this.rete.addRule('avoidRepetition', [
      { key: 'history', test: (h) => Array.isArray(h) && h.length >= 2 }
    ], (facts) => {
      const h = facts.history;
      const last = h[h.length - 1];
      return h.slice(-3, -1).every((word) => word !== last);
    });
  }

  /**
   * Tokenization. Keeps contractions/possessives intact ("i'm", "love's")
   * instead of splitting them into garbage fragments ("i" + "m"), and
   * normalizes typographic apostrophes (') to ASCII so "It’s" and "it's"
   * share one token.
   */
  _tokenize(text) {
    const raw = String(text ?? '').toLowerCase().match(/[a-z0-9]+(?:['\u2019][a-z0-9]+)*/g) || [];
    return raw.map((t) => t.replace(/\u2019/g, "'"));
  }

  /**
   * Lightweight corpus fingerprint so we can skip rebuilding
   * embeddings/PCA when the training data has not changed.
   */
  _corpusSignature(corpus) {
    let hash = 0;
    for (const line of corpus) {
      const text = String(line);
      for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
      }
      hash = (hash ^ (text.length + corpus.length)) >>> 0;
    }
    return `${corpus.length}:${hash}`;
  }

  _asNumberArray(arr, length, fill = 0) {
    const safe = Array.isArray(arr) ? arr : [];
    const out = [];
    for (let i = 0; i < (length ?? safe.length); i++) {
      const v = safe[i];
      out.push(Number.isFinite(v) ? v : fill);
    }
    return out;
  }

  _asNumberMatrix(mat) {
    if (!Array.isArray(mat)) return [];
    return mat.map((row) => this._asNumberArray(row));
  }

  _invalidateCaches() {
    this._vocabCache = null;
    this._analysisCache = new Map();
  }

  /** Cached vocab arrays for fast candidate scoring (#28). */
  _ensureVocabCache() {
    if (this._vocabCache) return this._vocabCache;
    const words = Array.from(this.vocabulary);
    this._vocabCache = {
      words,
      eSpace: words.map((w) => this.emotionalSpace.get(w) || null),
      freq: words.map((w) => this.frequencies.get(w) || 1)
    };
    return this._vocabCache;
  }

  /**
   * Memoized phonetic analysis — analyze() is called for every candidate
   * word during beam search, so cache aggressively (#28).
   */
  _analysis(word) {
    let a = this._analysisCache.get(word);
    if (!a) {
      try {
        a = this.ule.analyze(word);
      } catch (e) {
        a = { word, phonemes: '', syllables: 1, stressPattern: [0], rhymePart: String(word) };
      }
      if (this._analysisCache.size > 20000) this._analysisCache.clear();
      this._analysisCache.set(word, a);
    }
    return a;
  }

  /**
   * Advanced syllable counting via ULE
   */
  _countSyllables(word) {
    return this._analysis(word).syllables;
  }

  /**
   * Generate stress pattern for a word sequence.
   */
  _getStressPattern(words) {
    return words.flatMap((word) => this._analysis(word).stressPattern);
  }

  _euclidean(a, b) {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Train on poetry corpus.
   * Builds vocabulary, co-occurrence embeddings, bigram index, Kernel PCA and
   * trains the TD value estimator for the requested number of epochs (#11).
   * @param {Array} corpus - Array of text lines to train on
   * @param {number} epochs - Number of TD training passes
   * @param {boolean} incremental - If true, expands existing vocabulary rather than replacing it
   */
  train(corpus, epochs = 10, incremental = false) {
    const corpusSignature = this._corpusSignature(corpus);
    const shouldRebuild = this.lastCorpusSignature !== corpusSignature || !this.isTrained;

    if (shouldRebuild) {
      // Only clear if not doing incremental training
      if (!incremental) {
        this.embeddings.clear();
        this.emotionalSpace.clear();
        this.frequencies.clear();
        this.bigrams.clear();
      }

      // Build frequency-based vocabulary
      const freq = new Map();
      if (incremental) {
        this.vocabulary.forEach((word) => {
          freq.set(word, this.frequencies.get(word) || 1);
        });
      }
      corpus.forEach((text) => {
        this._tokenize(text).forEach((word) => {
          freq.set(word, (freq.get(word) || 0) + 1);
        });
      });

      const vocabEntries = Array.from(freq.entries())
        .filter(([, count]) => count >= (incremental ? 1 : 2)) // Lower threshold for incremental
        .sort((a, b) => b[1] - a[1]);

      const limitedVocab = vocabEntries.slice(0, this.maxKernelWords).map(([word]) => word);
      this.vocabulary = new Set(limitedVocab);

      this.frequencies = new Map();
      this.totalTokens = 0;
      for (const [word, count] of vocabEntries) {
        if (this.vocabulary.has(word)) {
          this.frequencies.set(word, count);
          this.totalTokens += count;
        }
      }

      // Initialize embeddings for new words only
      limitedVocab.forEach((word) => {
        if (!this.embeddings.has(word)) {
          this.embeddings.set(word, new Array(EMBEDDING_DIM).fill(0));
        }
      });

      // Co-occurrence embeddings: the NEIGHBOR IDENTITY (plus left/right
      // direction) is feature-hashed into the embedding dimension (#9).
      // The previous implementation wrote into `j % dim` — the sequence
      // position — encoding where a word occurred, not its context.
      const window = 3;
      corpus.forEach((text) => {
        const tokens = this._tokenize(text);
        tokens.forEach((word, i) => {
          if (!this.embeddings.has(word)) return;
          const embedding = this.embeddings.get(word);

          for (let j = Math.max(0, i - window); j < Math.min(tokens.length, i + window + 1); j++) {
            if (i === j) continue;
            const neighbor = tokens[j];
            if (this.embeddings.has(neighbor)) {
              const direction = j < i ? '<' : '>';
              const dim = hashSeedString(neighbor + direction) % EMBEDDING_DIM;
              embedding[dim] += 1;
            }
          }
        });

        // Bigram transition counts (#14)
        for (let i = 1; i < tokens.length; i++) {
          const a = tokens[i - 1];
          const b = tokens[i];
          if (this.vocabulary.has(a) && this.vocabulary.has(b)) {
            const key = `${a} ${b}`;
            this.bigrams.set(key, (this.bigrams.get(key) || 0) + 1);
          }
        }
      });

      // L2-normalize embeddings (#10)
      this.embeddings.forEach((embedding) => {
        const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
        if (norm > 1e-12) {
          for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
        }
      });

      // Train Kernel PCA on the FULL embedding vectors (#8)
      const wordsForX = limitedVocab.filter((w) => this.embeddings.has(w));
      const X = wordsForX.map((w) => this.embeddings.get(w));

      if (X.length > 0) {
        this.kpca.fit(X);

        // Batch-transform the whole vocabulary in one call (#7b)
        const projected = this.kpca.transform(X);
        wordsForX.forEach((word, i) => {
          this.emotionalSpace.set(word, projected[i]);
        });
      }

      this.lastCorpusSignature = corpusSignature;
      this._invalidateCaches();
    }

    // Pre-train value estimator on corpus — for the requested number of
    // epochs; the previous implementation mislabeled the corpus loop index
    // as the epoch and always ran a single pass (#11).
    const nEpochs = Math.max(1, Math.floor(Number(epochs)) || 1);
    let totalReward = 0;
    let countedLines = 0;

    for (let epoch = 0; epoch < nEpochs; epoch++) {
      corpus.forEach((text) => {
        const lines = String(text)
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => this._tokenize(l).length > 0);
        if (lines.length === 0) return;

        let prevLineEnd = null;
        let runningTokens = [];
        const steps = lines.map((line, t) => {
          const lineTokens = this._tokenize(line);
          runningTokens = runningTokens.concat(lineTokens);
          const state = this._getState(runningTokens, line, t, lines.length, prevLineEnd);
          const reward = this._calculateReward(line, runningTokens, prevLineEnd);
          prevLineEnd = lineTokens[lineTokens.length - 1];
          return { state, reward };
        });

        for (let t = 0; t < steps.length; t++) {
          const done = t === steps.length - 1;
          const nextState = done ? null : steps[t + 1].state;
          this.valueEstimator.update(steps[t].state, steps[t].reward, nextState, done);
          totalReward += steps[t].reward;
          countedLines++;
        }
      });
    }

    this.isTrained = true;
    return countedLines > 0 ? totalReward / countedLines : 0;
  }

  /**
   * Serialize the model state so it can be downloaded as a checkpoint.
   */
  saveCheckpoint() {
    if (!this.isTrained) {
      throw new Error('Train the model before saving a checkpoint');
    }

    return {
      version: 2,
      kpca: {
        nComponents: this.kpca.nComponents,
        degree: this.kpca.degree,
        eigenvectors: this.kpca.eigenvectors,
        eigenvalues: this.kpca.eigenvalues,
        X_fit: this.kpca.X_fit
      },
      valueEstimator: {
        weights: this.valueEstimator.weights,
        alpha: this.valueEstimator.alpha,
        gamma: this.valueEstimator.gamma,
        lambda: this.valueEstimator.lambda,
        eligibility: this.valueEstimator.eligibility
      },
      vocabulary: Array.from(this.vocabulary),
      frequencies: Array.from(this.frequencies.entries()),
      bigrams: Array.from(this.bigrams.entries()).slice(0, 50000),
      embeddings: Array.from(this.embeddings.entries()),
      emotionalSpace: Array.from(this.emotionalSpace.entries()),
      rng: {
        state: this.rng.state,
        index1: this.rng.index1,
        index2: this.rng.index2
      },
      lastCorpusSignature: this.lastCorpusSignature,
      isTrained: this.isTrained
    };
  }

  /**
   * Load a previously saved checkpoint.
   * Accepts: version 2, version 1, and the legacy train-lyrics.js format
   * (`kernelPCA` key, `[word, freq]` vocabulary, no version field) (#19).
   */
  loadCheckpoint(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid checkpoint format');
    }

    if (data.version === 2 || data.version === 1) {
      this._loadV1V2Checkpoint(data);
    } else if (data.kernelPCA && Array.isArray(data.vocabulary) && Array.isArray(data.embeddings)) {
      this._loadLegacyCheckpoint(data);
    } else {
      throw new Error('Invalid checkpoint format');
    }

    // Rebuild derived structures after any load.
    this.kpca._rebuildAlphas();
    this.kpca._rowMeans = null; // recomputed lazily if transform() is used
    this._invalidateCaches();
  }

  _restoreKpca(kpcaData) {
    this.kpca = new KernelPCA(
      Number.isFinite(kpcaData?.nComponents) && kpcaData.nComponents > 0 ? Math.floor(kpcaData.nComponents) : 8,
      Number.isFinite(kpcaData?.degree) && kpcaData.degree > 0 ? kpcaData.degree : 3,
      () => this.rng.next()
    );
    this.kpca.eigenvectors = this._asNumberMatrix(kpcaData?.eigenvectors);
    this.kpca.eigenvalues = this._asNumberArray(kpcaData?.eigenvalues);
    this.kpca.X_fit = this._asNumberMatrix(kpcaData?.X_fit);
  }

  _restoreValueEstimator(veData) {
    // Feature count follows the emotional-space dimensionality (#15).
    this.valueEstimator = new TDValueEstimator(
      this.kpca.nComponents,
      Number.isFinite(veData?.alpha) ? veData.alpha : 0.01,
      Number.isFinite(veData?.gamma) ? veData.gamma : 0.95,
      Number.isFinite(veData?.lambda) ? veData.lambda : 0.8,
      () => this.rng.next()
    );
    const n = this.valueEstimator.nFeatures;
    const weights = this._asNumberArray(veData?.weights, n, 0);
    const eligibility = this._asNumberArray(veData?.eligibility, n, 0);
    this.valueEstimator.weights = weights;
    this.valueEstimator.eligibility = eligibility;
  }

  _restoreRng(rngData) {
    if (!rngData) return;
    // Sanitize: integers in [0, modulus), indices mod 55, reseed an
    // all-zero state so the generator is never dead (#18).
    if (Array.isArray(rngData.state)) {
      const state = new Array(55);
      for (let i = 0; i < 55; i++) {
        const v = Math.floor(Number(rngData.state[i]));
        state[i] = Number.isFinite(v) ? ((v % LFG_MODULUS) + LFG_MODULUS) % LFG_MODULUS : 0;
      }
      if (state.every((v) => v === 0)) {
        this.rng._initialize(123456789);
      } else {
        this.rng.state = state;
      }
    }
    const i1 = Math.floor(Number(rngData.index1));
    const i2 = Math.floor(Number(rngData.index2));
    if (Number.isFinite(i1)) this.rng.index1 = ((i1 % 55) + 55) % 55;
    if (Number.isFinite(i2)) this.rng.index2 = ((i2 % 55) + 55) % 55;
  }

  _loadV1V2Checkpoint(data) {
    this._restoreKpca(data.kpca);
    this._restoreValueEstimator(data.valueEstimator);

    // Vocabulary: array of words (v1/v2) or [word, freq] pairs (defensive)
    this.vocabulary = new Set();
    this.frequencies = new Map();
    const vocab = Array.isArray(data.vocabulary) ? data.vocabulary : [];
    for (const entry of vocab) {
      if (Array.isArray(entry) && typeof entry[0] === 'string') {
        this.vocabulary.add(entry[0]);
        this.frequencies.set(entry[0], Number.isFinite(entry[1]) ? entry[1] : 1);
      } else if (typeof entry === 'string') {
        this.vocabulary.add(entry);
        this.frequencies.set(entry, 1);
      }
    }

    if (data.version === 2 && Array.isArray(data.frequencies)) {
      for (const [word, count] of data.frequencies) {
        if (typeof word === 'string' && this.vocabulary.has(word)) {
          this.frequencies.set(word, Number.isFinite(count) ? count : 1);
        }
      }
    }

    this.bigrams = new Map();
    if (Array.isArray(data.bigrams)) {
      for (const [key, count] of data.bigrams) {
        if (typeof key === 'string' && Number.isFinite(count)) this.bigrams.set(key, count);
      }
    }

    this.totalTokens = 0;
    this.frequencies.forEach((c) => {
      this.totalTokens += c;
    });

    const embeddingEntries = Array.isArray(data.embeddings) ? data.embeddings : [];
    this.embeddings = new Map(
      embeddingEntries
        .filter(([k]) => typeof k === 'string')
        .map(([k, v]) => [k, this._asNumberArray(v, EMBEDDING_DIM, 0)])
    );

    const emotionalEntries = Array.isArray(data.emotionalSpace) ? data.emotionalSpace : [];
    this.emotionalSpace = new Map(
      emotionalEntries
        .filter(([k]) => typeof k === 'string')
        .map(([k, v]) => [k, this._asNumberArray(v, this.kpca.nComponents, 0)])
    );

    this._restoreRng(data.rng);
    this.lastCorpusSignature = data.lastCorpusSignature || null;
    this.isTrained = !!data.isTrained;
  }

  _loadLegacyCheckpoint(data) {
    // train-lyrics.js checkpoint format (#19)
    this._restoreKpca(data.kernelPCA);
    this._restoreValueEstimator(data.valueEstimator);

    this.vocabulary = new Set();
    this.frequencies = new Map();
    for (const entry of data.vocabulary) {
      if (Array.isArray(entry) && typeof entry[0] === 'string') {
        this.vocabulary.add(entry[0]);
        this.frequencies.set(entry[0], Number.isFinite(entry[1]) ? entry[1] : 1);
      } else if (typeof entry === 'string') {
        this.vocabulary.add(entry);
        this.frequencies.set(entry, 1);
      }
    }

    this.bigrams = new Map(); // not present in legacy checkpoints; priors fall back to unigrams
    this.totalTokens = 0;
    this.frequencies.forEach((c) => {
      this.totalTokens += c;
    });

    this.embeddings = new Map(
      (Array.isArray(data.embeddings) ? data.embeddings : [])
        .filter(([k]) => typeof k === 'string')
        .map(([k, v]) => [k, this._asNumberArray(v, EMBEDDING_DIM, 0)])
    );

    this.emotionalSpace = new Map(
      (Array.isArray(data.emotionalSpace) ? data.emotionalSpace : [])
        .filter(([k]) => typeof k === 'string')
        .map(([k, v]) => [k, this._asNumberArray(v, this.kpca.nComponents, 0)])
    );

    this._restoreRng(data.rng);
    this.lastCorpusSignature = data.lastCorpusSignature || null;
    this.isTrained = data.isTrained !== false;
  }

  /**
   * Construct poetic state representation.
   * `prevLineEnd` feeds the real rhyme-consistency feature (#13).
   */
  _getState(tokens, currentLine, lineIndex, totalLines, prevLineEnd = null) {
    const dim = this.kpca.nComponents;
    const eSpaceTraj = tokens
      .slice(-10)
      .map((t) => this.emotionalSpace.get(t))
      .filter((v) => Array.isArray(v));
    const words = this._tokenize(currentLine);

    return {
      eSpaceTraj: eSpaceTraj.length > 0 ? eSpaceTraj : [new Array(dim).fill(0)],
      meterScore: FFTMeterAnalyzer.analyzeStressPattern(this._getStressPattern(words)),
      rhymeConsistency: this._checkRhymeConsistency(tokens, prevLineEnd),
      novelty: 1 - this._calculateRepetitionScore(tokens),
      lineCount: lineIndex,
      themeCoherence: this._calculateThemeCoherence(eSpaceTraj)
    };
  }

  /**
   * Calculate reward for generated line
   */
  _calculateReward(line, tokens, prevLineEnd = null) {
    const words = this._tokenize(line);
    const syntaxScore = words.length > 0 && this.parser.parse(words) ? 1 : 0.3;
    const meterScore = FFTMeterAnalyzer.analyzeStressPattern(this._getStressPattern(words));
    const diversity = 1 - this._calculateRepetitionScore(tokens);
    const rhyme = this._checkRhymeConsistency(tokens, prevLineEnd);

    return (syntaxScore + meterScore + diversity + rhyme) / 4;
  }

  /**
   * Rhyme consistency between the current line ending and the previous one.
   * Previously returned 1.0 for any analyzable word — a constant feature (#13).
   */
  _checkRhymeConsistency(tokens, prevLineEnd = null) {
    if (!Array.isArray(tokens) || tokens.length === 0) return 0.5;
    if (!prevLineEnd) return 0.5;
    const lastWord = tokens[tokens.length - 1];
    try {
      const current = this._analysis(lastWord);
      const previous = this._analysis(prevLineEnd);
      return rhymeSimilarity(current.rhymePart, previous.rhymePart);
    } catch (e) {
      return 0.5;
    }
  }

  /**
   * Repetition pressure over the recent token window.
   * Guarded against empty windows (0/0 produced NaN that poisoned the
   * TD weights) (#12).
   */
  _calculateRepetitionScore(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return 0;
    const last15 = tokens.slice(-15);
    const unique = new Set(last15);
    return 1 - unique.size / last15.length;
  }

  /**
   * Calculate thematic coherence via emotional space distance
   */
  _calculateThemeCoherence(eSpaceTraj) {
    if (eSpaceTraj.length < 2) return 1;

    let totalDist = 0;
    for (let i = 1; i < eSpaceTraj.length; i++) {
      const dist = Math.sqrt(
        eSpaceTraj[i].reduce((sum, v, j) => {
          const diff = v - (eSpaceTraj[i - 1][j] || 0);
          return sum + diff * diff;
        }, 0)
      );
      totalDist += Math.min(dist, 1);
    }

    return 1 - totalDist / (eSpaceTraj.length - 1);
  }

  /**
   * Log-probability of `word` given the trailing context under the
   * interpolated bigram/unigram prior learned during training (#14, #28).
   * A temperature < 1 flattens the raw MLE distribution so a small corpus
   * cannot collapse generation onto a few high-frequency function words.
   */
  _logProb(contextWords, word) {
    const total = this.totalTokens || 1;
    const uni = (this.frequencies.get(word) || 0) / total;

    // Average the smoothed bigram probability over the last few context words
    // (not just the final token) so prompt/theme words steer continuation.
    const ctx = contextWords.slice(-3);
    let biSum = 0;
    let biN = 0;
    for (const c of ctx) {
      const leftCount = this.frequencies.get(c) || 0;
      if (leftCount === 0) continue;
      const vocabSize = this.vocabulary.size || 1;
      const biCount = this.bigrams.get(`${c} ${word}`) || 0;
      biSum += (biCount + 0.1) / (leftCount + 0.1 * vocabSize);
      biN++;
    }

    let p;
    if (biN === 0) {
      // No bigram evidence from the context: fall back to a FLAT mix of the
      // unigram and a uniform distribution, so generation is steered by
      // emotion/meter objectives instead of raw function-word frequency.
      const uniform = 1 / (this.vocabulary.size || 1);
      p = 0.5 * uni + 0.5 * uniform;
    } else {
      p = 0.6 * (biSum / biN) + 0.4 * uni;
    }
    return PRIOR_TEMPERATURE * Math.log(p + 1e-12);
  }

  /**
   * Bounded prior cost in ~[0, 2]: the tempered negative log-probability
   * normalized by log(vocab size). Keeps the prior influential without
   * drowning the meter/emotion/repetition objectives.
   */
  _priorCost(contextWords, word) {
    const scale = Math.log((this.vocabulary.size || 2) + 3);
    return Math.min(2, -this._logProb(contextWords, word) / scale);
  }

  /**
   * Candidate continuations of the current context (#28).
   * Returns the union of the top-k/2 words by language-model prior and the
   * top-k/2 by emotional proximity (to the previous word and the prompt
   * anchor) — ranking by prior alone would let high-frequency function words
   * crowd thematically relevant content words out of the beam entirely.
   */
  _getCandidateWords(context, beamWidth, promptESpace = null) {
    this._ensureVocabCache();
    const { words, eSpace } = this._vocabCache;
    if (words.length === 0) return [];

    const lastWord = context.length > 0 ? context[context.length - 1] : null;
    const lastESpace = lastWord ? this.emotionalSpace.get(lastWord) || null : null;
    const k = Math.max(beamWidth * 5, 10);
    const half = Math.ceil(k / 2);

    const byPrior = [];
    const byEmotion = [];
    const ctx = context.slice(-3);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word === lastWord) continue;

      const prior = -this._priorCost(ctx, word);
      byPrior.push({ word, score: prior });

      const es = eSpace[i];
      let emotion = 0;
      if (es) {
        if (lastESpace) emotion += 0.5 / (1 + this._euclidean(es, lastESpace));
        if (promptESpace) emotion += 0.5 / (1 + this._euclidean(es, promptESpace));
      }
      byEmotion.push({ word, score: emotion });
    }

    byPrior.sort((a, b) => b.score - a.score);
    byEmotion.sort((a, b) => b.score - a.score);

    const seen = new Set();
    const merged = [];
    for (const cand of byPrior.slice(0, half).concat(byEmotion.slice(0, half))) {
      if (seen.has(cand.word)) continue;
      seen.add(cand.word);
      merged.push(cand);
    }
    return merged;
  }

  /**
   * Multi-objective local cost (lower is better) for extending a beam
   * hypothesis with `word` (#28): language-model prior, meter, emotional
   * continuity, prompt-anchor alignment, graded rhyme near the line end,
   * syllable proximity shaping, repetition/cycle penalties, and the TD
   * aesthetic value estimate.
   */
  _scoreCandidate({ prevContext, words, context, syllables, targetSyllables, rhymeTarget, rhymeTargetAnalysis, promptESpace, step, maxSteps }) {
    const word = words[words.length - 1];
    const analysis = this._analysis(word);

    // Path cost: negative log-likelihood under the trained prior (replaces
    // the old pure-noise `-log(rng)` term). Bounded so it can't dominate.
    const priorCost = this._priorCost(prevContext, word);

    // Meter
    const meterScore = FFTMeterAnalyzer.analyzeStressPattern(this._getStressPattern(words));
    const meterCost = 1 - meterScore;

    // Emotional continuity with the previous word + alignment with the prompt
    let emotionCost = 0;
    const prevWord = prevContext.length > 0 ? prevContext[prevContext.length - 1] : null;
    const curESpace = this.emotionalSpace.get(word);
    if (prevWord && curESpace) {
      const prevESpace = this.emotionalSpace.get(prevWord);
      if (prevESpace) {
        const d = this._euclidean(prevESpace, curESpace);
        emotionCost += 0.5 * (d / (1 + d));
      }
    }
    if (promptESpace && curESpace) {
      const d = this._euclidean(promptESpace, curESpace);
      emotionCost += 0.5 * (d / (1 + d));
    }

    // Graded rhyme near the end of the line (not just exact equality)
    let rhymeCost = 0;
    if (rhymeTarget && rhymeTargetAnalysis && syllables >= targetSyllables - 2) {
      const sim = rhymeSimilarity(analysis.rhymePart, rhymeTargetAnalysis.rhymePart);
      rhymeCost = 1 - sim;
    }

    // Syllable proximity shaping: gentle pressure to keep filling the line,
    // strong penalty for overshooting the budget.
    const remaining = targetSyllables - syllables;
    const sylCost = remaining >= 0
      ? 0.05 * (remaining / Math.max(1, targetSyllables))
      : 0.5 * -remaining;

    // Repetition shaping: repeats inside the current line are penalized hard;
    // words already used by the prompt / earlier lines get a mild penalty so
    // the beam cannot collapse onto a single stock phrase across the poem.
    let lineRep = 0;
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i] === word) lineRep++;
    }
    let ctxRep = 0;
    for (let i = 0; i < prevContext.length; i++) {
      if (prevContext[i] === word) ctxRep++;
    }
    ctxRep -= lineRep; // prevContext includes the current line's words too
    const repetitionCost = 0.5 * lineRep + 0.12 * Math.min(Math.max(ctxRep, 0), 6);

    // Repetition collapse penalty (correct trailing-periodicity detection)
    const cycle = FloydCycleDetector.detect(context);
    const cycleCost = cycle.detected ? cycle.length * 2 : 0;

    // TD aesthetic value estimate
    const state = this._getState(context, words.join(' '), step, maxSteps);
    const aestheticValue = this.valueEstimator.estimate(state);
    const aestheticCost = Math.max(0, 1 - aestheticValue);

    // Objective balance: the prior is influential but bounded; emotion/theme
    // and meter carry comparable weight so content words surface.
    const β0 = 0.4, β1 = 0.5, β2 = 0.55, β3 = 0.3;
    const cost =
      β0 * priorCost +
      β1 * (meterCost + cycleCost) +
      β2 * (0.6 * emotionCost + 0.8 * rhymeCost + sylCost + repetitionCost) +
      β3 * aestheticCost;

    return { cost, meterScore, state };
  }

  /**
   * Generate single line of poetry using beam search (#28).
   * Keeps `beamWidth` partial hypotheses per step, expands each with the
   * top candidate words, prunes by cumulative cost, and selects the best
   * constraint-passing completion.
   */
  generateLine(prompt, targetSyllables = 10, beamWidth = 5, rhymeTarget = null, maxIter = 50) {
    if (!this.isTrained) throw new Error('Model must be trained before generation');

    const promptTokens = this._tokenize(prompt);
    const rhymeTargetAnalysis = rhymeTarget ? this._analysis(rhymeTarget) : null;
    const visited = [];
    const completions = [];

    // Emotional anchor = centroid of the prompt's emotional-space vectors.
    const promptVecs = promptTokens
      .map((t) => this.emotionalSpace.get(t))
      .filter((v) => Array.isArray(v));
    let promptESpace = null;
    if (promptVecs.length > 0) {
      const dim = this.kpca.nComponents;
      promptESpace = new Array(dim).fill(0);
      for (const vec of promptVecs) {
        for (let i = 0; i < dim; i++) promptESpace[i] += vec[i] || 0;
      }
      for (let i = 0; i < dim; i++) promptESpace[i] /= promptVecs.length;
    }

    const maxSteps = Math.max(4, Math.min(maxIter, targetSyllables + 4));
    let beam = [{ words: [], syllables: 0, cost: 0, context: promptTokens.slice() }];

    for (let step = 0; step < maxSteps && beam.length > 0; step++) {
      const nextBeam = [];

      for (const hyp of beam) {
        const candidates = this._getCandidateWords(hyp.context, beamWidth, promptESpace);
        for (const cand of candidates) {
          const word = cand.word;
          const syllables = this._countSyllables(word);
          const newSyllables = hyp.syllables + syllables;
          if (newSyllables > targetSyllables + SYLLABLE_TOLERANCE) continue;

          const newWords = hyp.words.concat(word);
          const newContext = hyp.context.concat(word);
          const { cost, state } = this._scoreCandidate({
            prevContext: hyp.context,
            words: newWords,
            context: newContext,
            syllables: newSyllables,
            targetSyllables,
            rhymeTarget,
            rhymeTargetAnalysis,
            promptESpace,
            step,
            maxSteps
          });

          nextBeam.push({
            words: newWords,
            syllables: newSyllables,
            cost: hyp.cost + cost,
            context: newContext,
            lastState: state
          });

          if (visited.length < 400) {
            visited.push({ word, score: hyp.cost + cost, step });
          }
        }
      }

      if (nextBeam.length === 0) break;
      nextBeam.sort((a, b) => a.cost - b.cost);
      beam = nextBeam.slice(0, beamWidth);

      // Record hypotheses that have reached the syllable window.
      for (const hyp of beam) {
        if (hyp.syllables >= targetSyllables - 1 && hyp.syllables <= targetSyllables + SYLLABLE_TOLERANCE) {
          completions.push(hyp);
        }
      }

      if (completions.length >= beamWidth && beam[0].syllables >= targetSyllables - 1) break;
    }

    completions.sort((a, b) => a.cost - b.cost);
    const pool = completions.length > 0 ? completions : beam.slice().sort((a, b) => a.cost - b.cost);

    // End-of-line Rete constraint verification (#20): prefer the cheapest
    // hypothesis that passes every applicable rule.
    let best = null;
    for (const hyp of pool) {
      if (hyp.words.length === 0) continue;
      const facts = {
        lastWord: hyp.words[hyp.words.length - 1],
        rhymeTarget: rhymeTarget || undefined,
        syllableCount: hyp.syllables,
        targetSyllables,
        history: hyp.context,
        atLineEnd: true
      };
      const violations = this.rete.evaluate(facts).filter((r) => !r.action(facts));
      if (violations.length === 0) {
        best = hyp;
        break;
      }
    }
    if (!best) best = pool.find((h) => h.words.length > 0) || { words: [], syllables: 0, cost: 0 };

    return {
      line: best.words.join(' '),
      syllableCount: best.syllables,
      finalState: this._getState(best.context, best.words.join(' '), 0, 0),
      visitedNodes: visited
    };
  }

  /**
   * Generate complete poem
   */
  generatePoem(prompt = 'love and shadow', lines = 4, beamWidth = 5) {
    const poem = [];
    const allTokens = this._tokenize(prompt);
    const states = [];
    const rewards = [];
    let previousEndWord = null;

    for (let i = 0; i < lines; i++) {
      // AABB scheme: every odd line rhymes with the previous line ending.
      const rhymeTarget = i % 2 === 1 ? previousEndWord : null;

      const lineObj = this.generateLine(
        poem.join(' ') + ' ' + prompt,
        10, // Iambic pentameter ~10 syllables
        beamWidth,
        rhymeTarget
      );

      const lineTokens = this._tokenize(lineObj.line);
      if (lineTokens.length > 0) {
        previousEndWord = lineTokens[lineTokens.length - 1];
      }

      poem.push(lineObj.line);
      allTokens.push(...this._tokenize(lineObj.line));
      states.push(lineObj.finalState);

      const reward = this._calculateReward(lineObj.line, allTokens);
      rewards.push(reward);
    }

    // Perform TD updates after all states are generated
    for (let i = 0; i < states.length; i++) {
      const nextState = i < states.length - 1 ? states[i + 1] : null;
      this.valueEstimator.update(states[i], rewards[i], nextState, i === states.length - 1);
    }

    return {
      poem,
      states,
      reward: this._calculateReward(poem.join('\n'), allTokens)
    };
  }
}

export default AGTuneEngine;
