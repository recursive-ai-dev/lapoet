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



import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UniversalLinguisticEngine } from './UniversalLinguisticEngine';

// ============================================================================
// CORE ALGORITHM IMPLEMENTATIONS
// ============================================================================

/**
 * Kernel PCA for Non-linear Theme Embedding
 * Transforms word embeddings into emotional/thematic space using polynomial kernel
 */
class KernelPCA {
  constructor(nComponents = 12, degree = 3) {
    this.nComponents = nComponents;
    this.degree = degree;
    this.eigenvectors = null;
    this.eigenvalues = null;
    this.X_fit = null;
  }

  /**
   * Polynomial kernel computation: K(x,y) = (x·y + 1)^d
   * Enables non-linear dimensionality reduction
   */
  _polynomialKernel(x, y) {
    const dotProduct = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    return Math.pow(dotProduct + 1, this.degree);
  }

  /**
   * Centers the kernel matrix via row/column mean subtraction
   * K_centered = K - 1_n*K - K*1_n + 1_n*K*1_n
   */
  _centerKernelMatrix(K) {
    const n = K.length;
    const rowMeans = Array(n).fill(0);
    const colMeans = Array(n).fill(0);
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

    const centered = Array(n).fill().map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centered[i][j] = K[i][j] - rowMeans[i] - colMeans[j] + totalMean;
      }
    }

    return centered;
  }

  /**
   * Power iteration eigenvalue decomposition for top k eigenvectors
   * Uses Gram-Schmidt orthogonalization for numerical stability
   */
  _eigenDecomposition(matrix) {
    const n = matrix.length;
    const eigenvectors = [];
    const eigenvalues = [];
    
    for (let k = 0; k < Math.min(this.nComponents, n); k++) {
      // Initialize random vector for PCA eigenvalue decomposition
      // Math.random() is acceptable here: used for ML initialization, not cryptographic purposes
      let v = Array(n).fill().map(() => Math.random() - 0.5);
      
      // Gram-Schmidt orthogonalization against previous eigenvectors
      for (let i = 0; i < eigenvectors.length; i++) {
        const dot = v.reduce((sum, vi, idx) => sum + vi * eigenvectors[i][idx], 0);
        v = v.map((vi, idx) => vi - dot * eigenvectors[i][idx]);
      }
      
      // Power iteration (50 iterations for convergence)
      for (let iter = 0; iter < 50; iter++) {
        let newV = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            newV[i] += matrix[i][j] * v[j];
          }
        }
        v = newV;
        
        // Normalize
        const norm = Math.sqrt(v.reduce((sum, vi) => sum + vi * vi, 0));
        v = v.map(vi => vi / norm);
      }
      
      // Compute eigenvalue
      let eigenvalue = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          eigenvalue += v[i] * matrix[i][j] * v[j];
        }
      }
      
      eigenvectors.push(v);
      eigenvalues.push(Math.abs(eigenvalue));
    }
    
    return { eigenvectors, eigenvalues };
  }

  /**
   * Fit Kernel PCA to training data
   */
  fit(X) {
    this.X_fit = X;
    const n = X.length;
    
    // Compute kernel matrix
    const K = Array(n).fill().map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        K[i][j] = this._polynomialKernel(X[i], X[j]);
      }
    }
    
    // Center and decompose
    const K_centered = this._centerKernelMatrix(K);
    const { eigenvectors, eigenvalues } = this._eigenDecomposition(K_centered);
    
    this.eigenvectors = eigenvectors;
    this.eigenvalues = eigenvalues;
  }

  /**
   * Transform new data into kernel space
   */
  transform(X) {
    const n_fit = this.X_fit.length;
    const n_transform = X.length;
    const result = Array(n_transform).fill().map(() => Array(this.nComponents).fill(0));
    
    for (let i = 0; i < n_transform; i++) {
      for (let j = 0; j < n_fit; j++) {
        const kij = this._polynomialKernel(X[i], this.X_fit[j]);
        for (let k = 0; k < this.nComponents; k++) {
          result[i][k] += kij * this.eigenvectors[k][j];
        }
      }
    }
    
    return result;
  }
}

/**
 * Temporal Difference Value Estimator (TD-λ)
 * Estimates aesthetic value of poetic states for reinforcement learning
 */
class TDValueEstimator {
  constructor(nFeatures = 24, alpha = 0.01, gamma = 0.95, lambda = 0.8) {
    // Math.random() is acceptable here: used for neural network weight initialization, not cryptographic purposes
    this.weights = Array(nFeatures).fill(0).map(() => Math.random() * 0.01);
    this.alpha = alpha;
    this.gamma = gamma;
    this.lambda = lambda;
    this.eligibility = Array(nFeatures).fill(0);
  }

  /**
   * Extract feature vector from poetic state
   * Features: emotional space trajectory, meter, rhyme, novelty, etc.
   */
  _extractFeatures(state) {
    const features = [];

    // Handle null state
    if (!state || !state.eSpaceTraj) {
      return Array(this.weights.length).fill(0);
    }

    // Average emotional space vector
    const eSpaceCenter = state.eSpaceTraj.reduce((acc, vec) => {
      vec.forEach((v, i) => acc[i] = (acc[i] || 0) + v);
      return acc;
    }, Array(state.eSpaceTraj[0]?.length || 12).fill(0));

    eSpaceCenter.forEach(v => features.push(v / (state.eSpaceTraj.length || 1)));

    // Additional poetic features
    features.push(state.meterScore || 0);
    features.push(state.rhymeConsistency || 0);
    features.push(state.novelty || 0);
    features.push(state.lineCount / 100 || 0);
    features.push(state.themeCoherence || 0);

    // Pad or truncate to exact feature count
    while (features.length < this.weights.length) features.push(0);
    return features.slice(0, this.weights.length);
  }

  /**
   * Estimate state value V(s) = w·φ(s)
   */
  estimate(state) {
    const features = this._extractFeatures(state);
    return features.reduce((sum, f, i) => sum + f * this.weights[i], 0);
  }

  /**
   * Update weights using TD(λ) algorithm
   * Δw = αδe, where δ = r + γV(s') - V(s)
   */
  update(state, reward, nextState, done) {
    const phi = this._extractFeatures(state);
    const phiNext = done ? Array(this.weights.length).fill(0) : this._extractFeatures(nextState);
    
    const v = phi.reduce((sum, f, i) => sum + f * this.weights[i], 0);
    const vNext = phiNext.reduce((sum, f, i) => sum + f * this.weights[i], 0);
    
    const tdError = reward + (done ? 0 : this.gamma * vNext) - v;
    
    // Update eligibility traces
    this.eligibility = this.eligibility.map((e, i) => 
      this.gamma * this.lambda * e + phi[i]
    );
    
    // Update weights
    this.weights = this.weights.map((w, i) => 
      w + this.alpha * tdError * this.eligibility[i]
    );
    
    if (done) this.eligibility.fill(0);
  }
}

/**
 * Lagged Fibonacci Generator (LFG)
 * High-quality pseudo-random number generator for stochastic generation
 */
class LaggedFibonacciGenerator {
  constructor(seed = Date.now()) {
    this.state = Array(55).fill(0);
    this.index1 = 0;
    this.index2 = 24;
    this._initialize(seed);
  }

  /**
   * Initialize state using Park-Miller LCG
   */
  _initialize(seed) {
    let s = seed % 2147483647;
    for (let i = 0; i < 55; i++) {
      s = (s * 48271) % 2147483647;
      this.state[i] = s;
    }
  }

  /**
   * Generate next random number in [0, 1)
   */
  next() {
    const result = (this.state[this.index1] + this.state[this.index2]) % 2147483647;
    this.state[this.index1] = result;
    this.index1 = (this.index1 + 1) % 55;
    this.index2 = (this.index2 + 1) % 55;
    return result / 2147483647;
  }
}

/**
 * Rete Algorithm for Constraint Checking
 * Efficient forward-chaining rule engine for poetic constraints
 */
class ReteEngine {
  constructor() {
    this.alphaNodes = [];
    this.betaNodes = [];
    this.rules = [];
  }

  /**
   * Add production rule to network
   * Rule: { name, conditions: [{key, test}], action: function }
   */
  addRule(name, conditions, action) {
    this.rules.push({ name, conditions, action });
    
    // Build alpha network (condition nodes)
    conditions.forEach(cond => {
      if (!this.alphaNodes.find(n => n.key === cond.key)) {
        this.alphaNodes.push({ key: cond.key, test: cond.test });
      }
    });
  }

  /**
   * Evaluate facts against all rules
   * Returns matching rules
   */
  evaluate(facts) {
    const matches = [];
    this.rules.forEach(rule => {
      const allMatch = rule.conditions.every(cond => {
        const fact = facts[cond.key];
        return fact !== undefined && cond.test(fact);
      });
      if (allMatch) matches.push(rule);
    });
    return matches;
  }
}

/**
 * Floyd's Cycle Detection for Repetition Detection
 * Detects repetitive patterns in token sequences using tortoise-hare algorithm
 */
class FloydCycleDetector {
  static detect(sequence, maxLookback = 15) {
    if (sequence.length < 4) return false;
    
    const tokens = sequence.slice(-maxLookback).map(t => t.token || t);
    
    let tortoise = 1;
    let hare = 2;
    
    while (hare < tokens.length) {
      if (tokens[tortoise] === tokens[hare]) {
        // Calculate cycle length
        let cycleLen = 1;
        let i = tortoise + 1;
        while (i < hare && tokens[i] === tokens[tortoise + (i - tortoise) % (hare - tortoise)]) {
          cycleLen++;
          i++;
        }
        return { detected: true, length: cycleLen };
      }
      tortoise++;
      hare += 2;
    }
    
    return { detected: false, length: 0 };
  }
}

/**
 * CYK Parser for Structural Validation
 * O(n³) context-free grammar parser for syntactic validation
 */
class CYKParser {
  constructor(grammar) {
    this.grammar = grammar;
    this.nonTerminals = new Set(Object.keys(grammar));
  }

  /**
   * Parse token sequence against grammar
   * Returns true if valid sentence structure
   */
  parse(tokens) {
    const n = tokens.length;
    if (n === 0) return true;
    
    // Initialize CYK table
    const table = Array(n).fill().map(() => 
      Array(n).fill().map(() => new Set())
    );
    
    // Terminal productions
    for (let i = 0; i < n; i++) {
      for (const [nt, productions] of Object.entries(this.grammar)) {
        if (productions.includes(tokens[i])) {
          table[i][i].add(nt);
        }
      }
    }
    
    // Non-terminal productions
    for (let len = 2; len <= n; len++) {
      for (let i = 0; i <= n - len; i++) {
        const j = i + len - 1;
        for (let k = i; k < j; k++) {
          for (const [nt, productions] of Object.entries(this.grammar)) {
            for (const prod of productions) {
              if (prod.length === 2) {
                const [left, right] = prod;
                if (table[i][k].has(left) && table[k+1][j].has(right)) {
                  table[i][j].add(nt);
                }
              }
            }
          }
        }
      }
    }
    
    return table[0][n-1].has('S'); // S = start symbol
  }
}

/**
 * FFT Meter Analyzer for Rhythmic Structure
 * Uses Fast Fourier Transform to analyze stress patterns
 */
class FFTMeterAnalyzer {
  static analyzeStressPattern(stresses, targetPattern = [0, 1]) {
    if (stresses.length < targetPattern.length * 2) return 0;
    
    // Pad to power of 2 for FFT
    const n = Math.pow(2, Math.ceil(Math.log2(stresses.length)));
    const padded = [...stresses, ...Array(n - stresses.length).fill(0)];
    const fft = this._fft(padded);
    
    // Find dominant frequency
    const magnitudes = fft.slice(0, n/2).map(c => Math.sqrt(c[0]*c[0] + c[1]*c[1]));
    const dominantFreq = magnitudes.indexOf(Math.max(...magnitudes));
    
    // Score match with target meter
    const targetFreq = targetPattern.length;
    const score = 1 - Math.min(Math.abs(dominantFreq - targetFreq) / n, 1);
    return score;
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
    for (let k = 0; k < n/2; k++) {
      const angle = -2 * Math.PI * k / n;
      const t = [
        Math.cos(angle) * odd[k][0] - Math.sin(angle) * odd[k][1],
        Math.cos(angle) * odd[k][1] + Math.sin(angle) * odd[k][0]
      ];
      
      result[k] = [even[k][0] + t[0], even[k][1] + t[1]];
      result[k + n/2] = [even[k][0] - t[0], even[k][1] - t[1]];
    }
    
    return result;
  }
}

// ============================================================================
// MAIN POETRY GENERATION ENGINE
// ============================================================================

/**
 * Aesthetic-Governed Transformative Engine (AG-TUNE)
 * Orchestrates all algorithms for multi-objective poetry generation
 */
class AGTuneEngine {
  constructor() {
    this.kpca = new KernelPCA(12, 3);
    this.valueEstimator = new TDValueEstimator(24, 0.01, 0.95, 0.8);
    this.rng = new LaggedFibonacciGenerator();
    this.rete = new ReteEngine();
    this.ule = new UniversalLinguisticEngine(); // Integration of Production-Grade Logic
    this.parser = new CYKParser(this.ule.getGrammar());
    this.vocabulary = new Set();
    this.embeddings = new Map();
    this.emotionalSpace = new Map();
    this.maxKernelWords = 2500; // cap to keep kernel matrix manageable
    this.lastCorpusSignature = null;
    this.isTrained = false;
    this._initializeReteRules();
  }

  /**
   * Initialize Rete constraint checking rules
   */
  _initializeReteRules() {
    // Rhyme scheme constraint: NOW USES DYNAMIC PHONETICS
    this.rete.addRule('rhymeCheck', [
      { key: 'lastWord', test: (w) => typeof w === 'string' && w.length > 0 },
      { key: 'rhymeTarget', test: (t) => typeof t === 'string' }
    ], (facts) => {
      if (!facts.rhymeTarget) return true;
      const w1 = this.ule.analyze(facts.lastWord);
      const w2 = this.ule.analyze(facts.rhymeTarget);
      return w1.rhymePart === w2.rhymePart;
    });

    // Syllable count constraint (8-10 for iambic pentameter)
    this.rete.addRule('syllableLimit', [
      { key: 'syllableCount', test: (n) => n <= 10 },
      { key: 'syllableCount', test: (n) => n >= 8 }
    ], () => true);

    // Repetition avoidance
    this.rete.addRule('avoidRepetition', [
      { key: 'lastWord', test: (w) => w !== undefined },
      { key: 'history', test: (h) => h.length < 3 || h.slice(-3).slice(0, -1).every(word => word !== h.slice(-1)[0]) }
    ], () => true);
  }

  /**
   * Simple tokenization
   */
  _tokenize(text) {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }

  /**
   * Lightweight corpus fingerprint so we can skip rebuilding
   * embeddings/PCA when the training data has not changed.
   */
  _corpusSignature(corpus) {
    let hash = 0;
    for (const line of corpus) {
      for (let i = 0; i < line.length; i++) {
        hash = (hash * 31 + line.charCodeAt(i)) >>> 0;
      }
      hash ^= line.length + corpus.length;
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
    if (length !== undefined && out.length < length) {
      while (out.length < length) out.push(fill);
    }
    return out;
  }

  _asNumberMatrix(mat) {
    if (!Array.isArray(mat)) return [];
    return mat.map(row => this._asNumberArray(row));
  }

  /**
   * Advanced syllable counting via ULE
   */
  _countSyllables(word) {
    return this.ule.analyze(word).syllables;
  }

  /**
   * Generate iambic pentameter stress pattern (alternating 0/1)
   */
  _getStressPattern(words) {
    return words.map((_, idx) => idx % 2 === 1 ? 1 : 0);
  }

  /**
   * Train on poetry corpus
   * Builds vocabulary, embeddings, and trains Kernel PCA + TD estimator
   * @param {Array} corpus - Array of text lines to train on
   * @param {number} epochs - Number of training epochs
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
      }
    }

    // Build frequency-based vocabulary
    if (shouldRebuild) {
      const freq = {};
      
      // Start with existing vocabulary if incremental
      if (incremental) {
        this.vocabulary.forEach(word => {
          // Set to 1 to ensure retention (actual frequency only used for filtering/sorting)
          freq[word] = 1;
        });
      }
      
      corpus.forEach(text => {
        this._tokenize(text).forEach(word => {
          freq[word] = (freq[word] || 0) + 1;
        });
      });
      
      const vocabEntries = Object.entries(freq)
        .filter(([_, count]) => count >= (incremental ? 1 : 2)) // Lower threshold for incremental
        .sort((a, b) => b[1] - a[1]);

      const limitedVocab = vocabEntries
        .slice(0, this.maxKernelWords)
        .map(([word]) => word);
      
      this.vocabulary = new Set(limitedVocab);
      
      // Initialize embeddings (co-occurrence based)
      const window = 3;
      limitedVocab.forEach(word => {
        if (!this.embeddings.has(word)) {
          this.embeddings.set(word, Array(64).fill(0));
        }
      });
      
      corpus.forEach(text => {
        const tokens = this._tokenize(text);
        tokens.forEach((word, i) => {
          if (!this.embeddings.has(word)) return;
          const embedding = this.embeddings.get(word);
          
          // Accumulate co-occurrences with context window
          for (let j = Math.max(0, i - window); j < Math.min(tokens.length, i + window + 1); j++) {
            if (i === j) continue;
            const neighbor = tokens[j];
            if (this.embeddings.has(neighbor)) {
              embedding[j % embedding.length] += 0.1;
            }
          }
        });
      });
      
      // Train Kernel PCA on embeddings
      const X = limitedVocab.filter(w => this.embeddings.has(w)).map(w => {
        const emb = this.embeddings.get(w);
        return emb.slice(0, Math.min(12, emb.length));
      });
      
      if (X.length > 0) {
        this.kpca.fit(X);
        
        // Transform vocabulary to emotional space
        limitedVocab.forEach(word => {
          if (this.embeddings.has(word)) {
            const emb = this.embeddings.get(word).slice(0, 12);
            const eSpace = this.kpca.transform([emb])[0];
            this.emotionalSpace.set(word, eSpace);
          }
        });
      }

      this.lastCorpusSignature = corpusSignature;
    }
    
    // Pre-train value estimator on corpus
    let totalReward = 0;
    corpus.forEach((text, epoch) => {
      const tokens = this._tokenize(text);
      const lines = text.split('\n');
      
      lines.forEach((line, t) => {
        const state = this._getState(tokens, line, t, lines.length);
        const reward = this._calculateReward(line, tokens);
        const nextState = t < lines.length - 1 
          ? this._getState(tokens, lines[t+1], t+1, lines.length) 
          : null;
        
        this.valueEstimator.update(state, reward, nextState, t === lines.length - 1);
        totalReward += reward;
      });
    });
    
    this.isTrained = true;
    return totalReward / corpus.length;
  }

  /**
   * Serialize the model state so it can be downloaded as a checkpoint.
   */
  saveCheckpoint() {
    if (!this.isTrained) {
      throw new Error('Train the model before saving a checkpoint');
    }

    return {
      version: 1,
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
   */
  loadCheckpoint(data) {
    if (!data || data.version !== 1) {
      throw new Error('Invalid checkpoint format');
    }

    // Restore KPCA (defensively sanitize numeric content)
    this.kpca = new KernelPCA(data.kpca?.nComponents || 8, data.kpca?.degree || 3);
    this.kpca.eigenvectors = this._asNumberMatrix(data.kpca?.eigenvectors);
    this.kpca.eigenvalues = this._asNumberArray(data.kpca?.eigenvalues);
    this.kpca.X_fit = this._asNumberMatrix(data.kpca?.X_fit);

    // Restore value estimator
    this.valueEstimator = new TDValueEstimator(
      data.valueEstimator?.weights?.length || 16,
      data.valueEstimator?.alpha ?? 0.01,
      data.valueEstimator?.gamma ?? 0.95,
      data.valueEstimator?.lambda ?? 0.8
    );
    this.valueEstimator.weights = this._asNumberArray(
      data.valueEstimator?.weights,
      this.valueEstimator.weights.length,
      0
    );
    this.valueEstimator.eligibility = this._asNumberArray(
      data.valueEstimator?.eligibility,
      this.valueEstimator.eligibility.length,
      0
    );

    // Restore maps/sets
    this.vocabulary = new Set(Array.isArray(data.vocabulary) ? data.vocabulary : []);

    const embeddingEntries = Array.isArray(data.embeddings) ? data.embeddings : [];
    this.embeddings = new Map(
      embeddingEntries.map(([k, v]) => [k, this._asNumberArray(v, 64, 0)])
    );

    const emotionalEntries = Array.isArray(data.emotionalSpace) ? data.emotionalSpace : [];
    this.emotionalSpace = new Map(
      emotionalEntries.map(([k, v]) => [k, this._asNumberArray(v, this.kpca.nComponents, 0)])
    );

    // RNG state
    if (data.rng) {
      if (Array.isArray(data.rng.state)) {
        this.rng.state = data.rng.state.map(n => Number.isFinite(n) ? n : 0);
      }
      this.rng.index1 = Number.isFinite(data.rng.index1) ? data.rng.index1 : this.rng.index1;
      this.rng.index2 = Number.isFinite(data.rng.index2) ? data.rng.index2 : this.rng.index2;
    }

    this.lastCorpusSignature = data.lastCorpusSignature || null;
    this.isTrained = !!data.isTrained;
  }

  /**
   * Construct poetic state representation
   */
  _getState(tokens, currentLine, lineIndex, totalLines) {
    const eSpaceTraj = tokens.slice(-10).map(t => this.emotionalSpace.get(t)).filter(v => v);
    const words = this._tokenize(currentLine);
    
    return {
      eSpaceTraj: eSpaceTraj.length > 0 ? eSpaceTraj : [Array(12).fill(0)],
      meterScore: FFTMeterAnalyzer.analyzeStressPattern(this._getStressPattern(words)),
      rhymeConsistency: this._checkRhymeConsistency(tokens),
      novelty: 1 - this._calculateRepetitionScore(tokens),
      lineCount: lineIndex,
      themeCoherence: this._calculateThemeCoherence(eSpaceTraj)
    };
  }

  /**
   * Calculate reward for generated line
   */
  _calculateReward(line, tokens) {
    const words = this._tokenize(line);
    const syntaxScore = this.parser.parse(words) ? 1 : 0.3;
    const meterScore = FFTMeterAnalyzer.analyzeStressPattern(this._getStressPattern(words));
    const diversity = 1 - this._calculateRepetitionScore(tokens);
    
    return (syntaxScore + meterScore + diversity) / 3;
  }

  _checkRhymeConsistency(tokens) {
    const lastWord = tokens[tokens.length - 1];
    return this._getRhymeGroup(lastWord) !== null ? 1 : 0.5;
  }

  _calculateRepetitionScore(tokens) {
    const last15 = tokens.slice(-15);
    const unique = new Set(last15);
    return 1 - (unique.size / last15.length);
  }

  /**
   * Calculate thematic coherence via emotional space distance
   */
  _calculateThemeCoherence(eSpaceTraj) {
    if (eSpaceTraj.length < 2) return 1;
    
    let totalDist = 0;
    for (let i = 1; i < eSpaceTraj.length; i++) {
      const dist = Math.sqrt(eSpaceTraj[i].reduce((sum, v, j) => {
        const diff = v - eSpaceTraj[i-1][j];
        return sum + diff * diff;
      }, 0));
      totalDist += Math.min(dist, 1);
    }
    
    return 1 - (totalDist / (eSpaceTraj.length - 1));
  }

  /**
   * Generate candidate words using beam search
   */
  _getCandidateWords(context, beamWidth) {
    const candidates = Array.from(this.vocabulary).filter(word => {
      if (word.length < 2 || word.length > 10) return false;
      return true;
    });
    
    // Score by emotional space proximity to last word
    const lastWord = context[context.length - 1];
    const lastESpace = this.emotionalSpace.get(lastWord) || Array(12).fill(0);
    
    const scored = candidates.map(word => {
      const eSpace = this.emotionalSpace.get(word);
      // Math.random() is acceptable here: used for fallback scoring in ML algorithm, not cryptographic purposes
      if (!eSpace) return { word, score: Math.random() };
      
      const dist = Math.sqrt(eSpace.reduce((sum, v, i) => {
        const diff = v - (lastESpace[i] || 0);
        return sum + diff * diff;
      }, 0));
      
      return { word, score: 1 / (1 + dist) * this.rng.next() };
    });
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, beamWidth * 5)
      .map(c => c.word);
  }

  /**
   * Generate single line of poetry using A*-guided beam search
   */
  generateLine(prompt, targetSyllables = 10, beamWidth = 5, rhymeTarget = null, maxIter = 50) {
    if (!this.isTrained) throw new Error('Model must be trained before generation');
    
    const context = this._tokenize(prompt);
    const line = [];
    let syllableCount = 0;
    const visited = [];
    
    for (let iter = 0; iter < maxIter && syllableCount < targetSyllables; iter++) {
      const candidates = this._getCandidateWords(context, beamWidth);
      
      const scored = candidates.map(word => {
        const newLine = [...line, word];
        const newContext = [...context, word];
        const syllables = this._countSyllables(word);
        const newSyllableCount = syllableCount + syllables;
        
        if (newSyllableCount > targetSyllables + 2) {
          return { word: null, score: Infinity };
        }
        
        // g(n): path cost (negative log-likelihood)
        const g = -Math.log(this.rng.next() + 0.01);
        
        // H(n): heuristic cost (multi-objective)
        const meterScore = FFTMeterAnalyzer.analyzeStressPattern(this._getStressPattern(newLine));

        // Use logic-based rhyming preference if we are near the end of the line
        const analysis = this.ule.analyze(word);
        let rhymeBonus = 0;
        if (rhymeTarget && newSyllableCount >= targetSyllables - 2) {
             const targetAnalysis = this.ule.analyze(rhymeTarget);
             if (analysis.rhymePart === targetAnalysis.rhymePart) rhymeBonus = 2.0;
        }

        const cycle = FloydCycleDetector.detect(newContext);
        const cyclePenalty = cycle.detected ? cycle.length * 2 : 0;
        
        const state = this._getState(newContext, newLine.join(' '), iter, maxIter);
        const aestheticValue = this.valueEstimator.estimate(state);
        
        // Multi-objective: β1*Structure + β2*Theme + β3*V(S)
        const β1 = 0.3, β2 = 0.3, β3 = 0.4;
        const H = β1 * (1 - meterScore + cyclePenalty) + 
                  β2 * (1 - rhymeBonus) +
                  β3 * Math.max(0, 2 - aestheticValue);
        
        const totalScore = g + H;
        visited.push({ word, score: totalScore, state });
        
        return { word, score: totalScore, syllables, state };
      }).filter(c => c.word);
      
      // Beam pruning
      const best = scored.sort((a, b) => a.score - b.score).slice(0, beamWidth);
      if (best.length === 0) break;
      
      // Stochastic selection from top candidates
      const chosen = best[Math.floor(this.rng.next() * Math.min(2, best.length))];
      line.push(chosen.word);
      syllableCount += chosen.syllables;
      context.push(chosen.word);
      
      // Rete constraint verification
      const facts = {
        lastWord: chosen.word,
        rhymeTarget: (syllableCount >= targetSyllables - 2) ? rhymeTarget : null, // Only enforce at end of line
        syllableCount,
        history: context
      };
      const violations = this.rete.evaluate(facts).filter(r => !r.action(facts));
      
      if (violations.length > 0) {
        line.pop();
        syllableCount -= chosen.syllables;
        context.pop();
      }
    }
    
    return {
      line: line.join(' '),
      syllableCount,
      finalState: this._getState(context, line.join(' '), 0, 0),
      visitedNodes: visited
    };
  }

  /**
   * Generate complete poem
   */
  generatePoem(prompt = "love and shadow", lines = 4, beamWidth = 5) {
    const poem = [];
    const allTokens = this._tokenize(prompt);
    const states = [];
    const rewards = [];
    let previousEndWord = null;

    for (let i = 0; i < lines; i++) {
      // Simple AABB or ABAB logic could be implemented here.
      // For now, let's try to make every even line rhyme with the previous one (AABB style approximation)
      const rhymeTarget = (i % 2 === 1) ? previousEndWord : null;

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
      this.valueEstimator.update(
        states[i],
        rewards[i],
        nextState,
        i === states.length - 1
      );
    }

    return {
      poem,
      states,
      reward: this._calculateReward(poem.join('\n'), allTokens)
    };
  }
}

// ============================================================================
// REACT UI COMPONENT
// ============================================================================

/**
 * AG-TUNE Poet React Component
 * Interactive interface for training and poetry generation
 */
export default function AGTunePoet() {
  const [engine] = useState(() => new AGTuneEngine());
  const [corpus, setCorpus] = useState([]);
  const [trainingState, setTrainingState] = useState({
    isTraining: false,
    epoch: 0,
    totalReward: 0,
    progress: 0
  });
  const [generation, setGeneration] = useState({
    poem: [],
    states: [],
    reward: 0,
    isGenerating: false
  });
  const [parameters, setParameters] = useState({
    epochs: 5,
    lines: 4,
    beamWidth: 8,
    prompt: "whispers in the moonlight"
  });
  const [visualizations, setVisualizations] = useState({
    eSpace: [],
    weights: [],
    visited: []
  });
  const checkpointInputRef = useRef(null);

  const safeNumber = useCallback((n, fallback = 0) => (
    Number.isFinite(n) ? n : fallback
  ), []);
  const fmt = useCallback((n, digits = 2) => safeNumber(n).toFixed(digits), [safeNumber]);

  // Embedded training corpus (public domain poetry excerpts + lyrics)
  const embeddedCorpus = [
    // Shakespeare Sonnets
    "Shall I compare thee to a summer's day? Thou art more lovely and more temperate.",
    "When in disgrace with fortune and men's eyes I all alone beweep my outcast state,",
    "Let me not to the marriage of true minds admit impediments. Love is not love",
    "That time of year thou mayst in me behold when yellow leaves, or none, or few, do hang",
    "Full many a glorious morning have I seen flatter the mountain tops with sovereign eye",
    "Being your slave what should I do but tend upon the hours and times of your desire",
    "No longer mourn for me when I am dead than you shall hear the surly sullen bell",
    "That thou art blamed shall not be thy defect for slander's mark was ever yet the fair",
    
    // Romantic Era Poetry
    "I wandered lonely as a cloud that floats on high over vales and hills",
    "Season of mists and mellow fruitfulness close bosom friend of the maturing sun",
    "Tyger tyger burning bright in the forests of the night what immortal hand or eye",
    "She walks in beauty like the night of cloudless climes and starry skies",
    "The woods are lovely dark and deep but I have promises to keep",
    "Because I could not stop for death he kindly stopped for me",
    
    // Additional poetic corpus
    "The darkling night whispers secrets to the stars above the silent sea",
    "My heart breaks gently like waves upon the shore of memory",
    "Love's fire burns eternal in the soul's deepest shadow",
    "Time's swift river carries all dreams into the void",
    "The moon hangs low, a silver coin in heaven's dark purse",
    "Softly, softly, do not wake the sleeping dreams of yesterday",
    "Ancient winds carry tales of forgotten kingdoms lost to time",
    "In twilight's embrace we find the courage to dream beyond tomorrow",
    "Silent echoes of a thousand voices crying out for peace",
    "The mirror reflects not my face but the ghost of who I was",
    "Beneath the weeping willow I found solace in sorrow's song",
    "Dancing shadows paint the walls with memories of brighter days",
    "Crystal tears fall like rain upon the garden of my heart",
    "In darkness blooms a flower that knows no fear of night",
    "The compass spins eternal seeking true north in the storm"
  ];

  // Function to load lyrics from the lyrics folder
  // Note: In browser environment, lyrics must be loaded via file upload
  // The lyrics are pre-trained in the checkpoint file (agtune-lyrics-checkpoint.json)
  // which can be loaded using the "Load Checkpoint" button
  const loadLyricsCorpus = useCallback(async () => {
    const lyricModules = import.meta.glob('/lyrics/*.txt', { as: 'raw' });
    const entries = Object.entries(lyricModules);
    if (entries.length === 0) {
      console.warn('No lyric files detected in /lyrics. Use "Load Checkpoint" or file upload to expand the corpus.');
      return [...embeddedCorpus];
    }

    const loaded = await Promise.all(entries.map(async ([path, loader]) => {
      try {
        const content = await loader();
        return { path, content };
      } catch (error) {
        console.warn(`Failed to load lyrics from ${path}`, error);
        return { path, content: '' };
      }
    }));

    const lines = loaded.flatMap(({ content }) => content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0));
    const combined = [...embeddedCorpus, ...lines];
    return Array.from(new Set(combined));
  }, []);

  const loadCorpus = useCallback(() => {
    setCorpus(embeddedCorpus);
  }, []);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        // Split by lines and filter empty lines
        const lines = text.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        // Combine with existing corpus
        setCorpus(prev => [...prev, ...lines]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleCheckpointDownload = useCallback(() => {
    try {
      const data = engine.saveCheckpoint();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agtune-checkpoint-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to save checkpoint', err);
      alert('Train the model before saving a checkpoint.');
    }
  }, [engine]);

  const handleCheckpointUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Invalid file');
        const data = JSON.parse(text);
        engine.loadCheckpoint(data);

        setTrainingState(prev => ({
          ...prev,
          isTraining: false,
          epoch: prev.epoch || 1,
          progress: 0,
          totalReward: prev.totalReward || 0
        }));

        setGeneration(prev => ({
          ...prev,
          poem: [],
          states: [],
          reward: 0,
          isGenerating: false
        }));

      setVisualizations(prev => ({
        ...prev,
        eSpace: Array.from(engine.emotionalSpace.entries()).slice(0, 5),
        weights: [...engine.valueEstimator.weights],
        visited: []
      }));
    } catch (err) {
        console.error('Failed to load checkpoint', err);
        alert('Invalid checkpoint file.');
      } finally {
        if (checkpointInputRef.current) {
          checkpointInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  }, [engine, checkpointInputRef]);

  const train = useCallback(async () => {
    if (corpus.length === 0) {
      loadCorpus();
      return;
    }
    
    setTrainingState(prev => ({ 
      ...prev, 
      isTraining: true, 
      epoch: 0, 
      progress: 0 
    }));
    
    let totalReward = 0;
    for (let epoch = 0; epoch < parameters.epochs; epoch++) {
      const epochReward = engine.train(corpus, 1);
      totalReward += epochReward;
      
      setTrainingState(prev => ({
        isTraining: true,
        epoch: epoch + 1,
        totalReward: totalReward / (epoch + 1),
        progress: ((epoch + 1) / parameters.epochs) * 100
      }));
      
      // Update visualizations
      setVisualizations({
        eSpace: Array.from(engine.emotionalSpace.entries()).slice(0, 5),
        weights: [...engine.valueEstimator.weights],
        visited: []
      });
      
      await new Promise(resolve => setTimeout(resolve, 100)); // UI update breathing room
    }
    
    setTrainingState(prev => ({ ...prev, isTraining: false }));
  }, [corpus, engine, parameters.epochs, loadCorpus]);

  const generate = useCallback(() => {
    setGeneration(prev => ({ ...prev, isGenerating: true }));
    
    const result = engine.generatePoem(
      parameters.prompt,
      parameters.lines,
      parameters.beamWidth
    );
    
    setGeneration({
      poem: result.poem,
      states: result.states,
      reward: result.reward,
      isGenerating: false
    });
    
    setVisualizations(prev => ({
      ...prev,
      visited: result.states.map((state, i) => ({
        line: i,
        meter: state.meterScore,
        novelty: state.novelty,
        value: engine.valueEstimator.estimate(state)
      }))
    }));
  }, [engine, parameters]);

  useEffect(() => {
    loadCorpus();
  }, [loadCorpus]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Aesthetic-Governed Transformative Engine (AG-TUNE)</h1>
        <p>Novel Algorithmic Poetry Generation with Temporal Difference Learning</p>
      </div>

      <div style={styles.mainGrid}>
        {/* Training Control Panel */}
        <div style={styles.panel}>
          <h2>Training Control</h2>

          <div style={styles.controlGroup}>
            <label>Upload Training Corpus (.txt)</label>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              style={styles.fileInput}
            />
            <p style={styles.corpusInfo}>
              Corpus size: {corpus.length} lines
            </p>
          </div>

          <div style={styles.controlGroup}>
            <label>Epochs: {parameters.epochs}</label>
            <input
              type="range"
              min="1"
              max="50"
              value={parameters.epochs}
              onChange={(e) => setParameters(prev => ({
                ...prev,
                epochs: parseInt(e.target.value)
              }))}
            />
          </div>

          <button
            onClick={train}
            disabled={trainingState.isTraining}
            style={styles.button}
          >
            {trainingState.isTraining
              ? `Training... ${trainingState.progress.toFixed(0)}%`
              : 'Train Model'}
          </button>

          <div style={styles.buttonRow}>
            <button
              onClick={handleCheckpointDownload}
              disabled={!engine.isTrained}
              style={styles.rowButton}
            >
              Download Checkpoint
            </button>
            <label style={styles.uploadLabel}>
              Upload Checkpoint
              <input
                ref={checkpointInputRef}
                type="file"
                accept="application/json"
                onChange={handleCheckpointUpload}
                style={styles.hiddenFileInput}
              />
            </label>
          </div>
          
          {trainingState.epoch > 0 && (
            <div style={styles.stats}>
              <p>Average Reward: {trainingState.totalReward.toFixed(4)}</p>
              <p>Epochs Completed: {trainingState.epoch}</p>
              <p>Vocabulary Size: {engine.vocabulary.size}</p>
            </div>
          )}
        </div>

        {/* Generation Control Panel */}
        <div style={styles.panel}>
          <h2>Poetry Generation</h2>
          <div style={styles.controlGroup}>
            <label>Prompt:</label>
            <input 
              type="text" 
              value={parameters.prompt}
              onChange={(e) => setParameters(prev => ({
                ...prev, 
                prompt: e.target.value
              }))}
              style={styles.input}
            />
          </div>
          
          <div style={styles.controlGroup}>
            <label>Lines: {parameters.lines}</label>
            <input 
              type="range" 
              min="2" 
              max="16" 
              value={parameters.lines}
              onChange={(e) => setParameters(prev => ({
                ...prev, 
                lines: parseInt(e.target.value)
              }))}
            />
          </div>
          
          <div style={styles.controlGroup}>
            <label>Beam Width: {parameters.beamWidth}</label>
            <input 
              type="range" 
              min="3" 
              max="20" 
              value={parameters.beamWidth}
              onChange={(e) => setParameters(prev => ({
                ...prev, 
                beamWidth: parseInt(e.target.value)
              }))}
            />
          </div>
          
          <button 
            onClick={generate}
            disabled={!engine.isTrained || generation.isGenerating}
            style={styles.button}
          >
            {generation.isGenerating ? 'Generating...' : 'Generate Poem'}
          </button>
          
          <div style={styles.stats}>
            <p>Reward: {generation.reward.toFixed(4)}</p>
          </div>
        </div>

        {/* Poem Display */}
        <div style={styles.panel}>
          <h2>Generated Poem</h2>
          {generation.poem.length > 0 ? (
            <div style={styles.poem}>
              {generation.poem.map((line, i) => (
                <div key={i} style={styles.line}>
                  <span style={styles.lineNumber}>{i + 1}.</span> {line}
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.placeholder}>
              Train model and click Generate to create poetry
            </p>
          )}
        </div>

        {/* Internal State Visualizations */}
        <div style={styles.panel}>
          <h2>Internal States</h2>
          <div style={styles.vizGrid}>
            {/* Emotional Space */}
            <div>
              <h3>Emotional Space (Sample Words)</h3>
              <div style={styles.vizBox}>
                {visualizations.eSpace.map(([word, space]) => (
                  <div key={word} style={styles.eSpaceItem}>
                    <strong>{word}</strong>: {space.map(v => fmt(v, 2)).join(', ')}
                  </div>
                ))}
                {visualizations.eSpace.length === 0 && <p>No data</p>}
              </div>
            </div>
            
            {/* Value Estimator Weights */}
            <div>
              <h3>Value Estimator Weights</h3>
              <div style={styles.vizBox}>
                <div style={styles.weightsDisplay}>
                  {visualizations.weights.slice(0, 8).map((w, i) => {
                    const val = safeNumber(w);
                    return (
                    <div key={i} style={styles.weightBar}>
                      <span>W{i}</span>
                      <div style={{
                        ...styles.weightFill, 
                        width: `${Math.max(0, Math.min(100, (val + 1) * 50))}%`
                      }} />
                      <span>{fmt(val, 3)}</span>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Generation Metrics */}
            <div>
              <h3>Generation Metrics</h3>
              <div style={styles.vizBox}>
                {visualizations.visited.map((metric, i) => (
                  <div key={i} style={styles.metricRow}>
                    L{i}: M={fmt(metric.meter, 2)} N={fmt(metric.novelty, 2)} V={fmt(metric.value, 2)}
                  </div>
                ))}
                {visualizations.visited.length === 0 && <p>No generation yet</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <p>AG-TUNE: Multi-Objective Poetry Generation with Spectral & Reinforcement Learning</p>
        <p>Components: Kernel PCA, TD Learning, Rete Algorithm, CYK Parser, FFT Meter Analysis</p>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    fontFamily: 'monospace',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    background: '#0a0a0a',
    color: '#e0e0e0',
    minHeight: '100vh'
  },
  
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    padding: '20px',
    border: '1px solid #333',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
  },
  
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '20px'
  },
  
  panel: {
    border: '1px solid #444',
    padding: '15px',
    background: '#1a1a1a'
  },
  
  controlGroup: {
    margin: '10px 0'
  },
  
  button: {
    width: '100%',
    padding: '10px',
    margin: '10px 0',
    background: '#007acc',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background 0.3s'
  },

  buttonDisabled: {
    background: '#444',
    cursor: 'not-allowed'
  },

  buttonRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '10px',
    alignItems: 'stretch'
  },

  rowButton: {
    width: '100%',
    padding: '10px',
    margin: '0',
    background: '#007acc',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background 0.3s',
    textAlign: 'center',
    height: '100%'
  },

  uploadLabel: {
    width: '100%',
    padding: '10px',
    margin: '0',
    background: '#005fa3',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    display: 'block',
    height: '100%',
    boxSizing: 'border-box'
  },

  hiddenFileInput: {
    display: 'none'
  },
  
  input: {
    width: '100%',
    padding: '5px',
    margin: '5px 0',
    background: '#2a2a2a',
    border: '1px solid #555',
    color: 'white'
  },

  fileInput: {
    width: '100%',
    padding: '8px',
    margin: '5px 0',
    background: '#2a2a2a',
    border: '1px solid #555',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px'
  },

  corpusInfo: {
    margin: '5px 0',
    fontSize: '12px',
    color: '#888',
    fontStyle: 'italic'
  },

  stats: {
    marginTop: '15px',
    padding: '10px',
    background: '#2a2a2a',
    fontSize: '12px'
  },
  
  poem: {
    padding: '20px',
    background: '#0f0f0f',
    border: '1px solid #333',
    minHeight: '200px'
  },
  
  line: {
    margin: '10px 0',
    fontSize: '16px'
  },
  
  lineNumber: {
    color: '#666',
    display: 'inline-block',
    width: '30px'
  },
  
  placeholder: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '50px'
  },
  
  vizGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '15px'
  },
  
  vizBox: {
    maxHeight: '200px',
    overflowY: 'auto',
    background: '#0a0a0a',
    padding: '10px',
    fontSize: '12px'
  },
  
  eSpaceItem: {
    margin: '5px 0',
    padding: '2px',
    borderBottom: '1px solid #222'
  },
  
  weightsDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  
  weightBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  
  weightFill: {
    height: '5px',
    background: '#007acc',
    transition: 'width 0.3s'
  },
  
  metricRow: {
    padding: '3px',
    borderLeft: '3px solid #007acc',
    margin: '5px 0',
    paddingLeft: '8px'
  },
  
  footer: {
    textAlign: 'center',
    padding: '20px',
    borderTop: '1px solid #333',
    marginTop: '30px',
    fontSize: '12px',
    color: '#666'
  }
};
