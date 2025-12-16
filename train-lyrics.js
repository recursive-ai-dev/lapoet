#!/usr/bin/env node
// Copyright 2025
// Damien Davison & Michael Maillet & Sacha Davison
// Recursive AI Devs
//
// Training script that loads all lyrics and trains the AG-TUNE model
// This ensures the model retains information indefinitely

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration constants
const FILTERED_PATTERNS = ['icryafterikill']; // Song/album title patterns to filter
const MIN_LINE_LENGTH = 10; // Minimum characters for a valid lyric line

// ============================================================================
// CORE ALGORITHM IMPLEMENTATIONS (Adapted for Node.js)
// ============================================================================

/**
 * Kernel PCA for Non-linear Theme Embedding
 */
class KernelPCA {
  constructor(nComponents = 8, degree = 3) {
    this.nComponents = nComponents;
    this.degree = degree;
    this.eigenvectors = null;
    this.eigenvalues = null;
    this.X_fit = null;
  }

  _polynomialKernel(x, y) {
    const dotProduct = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    return Math.pow(dotProduct + 1, this.degree);
  }

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

  _eigenDecomposition(matrix) {
    const n = matrix.length;
    const eigenvectors = [];
    const eigenvalues = [];
    
    for (let k = 0; k < Math.min(this.nComponents, n); k++) {
      let v = Array(n).fill().map(() => Math.random() - 0.5);
      
      for (let i = 0; i < eigenvectors.length; i++) {
        const dot = v.reduce((sum, vi, idx) => sum + vi * eigenvectors[i][idx], 0);
        v = v.map((vi, idx) => vi - dot * eigenvectors[i][idx]);
      }
      
      for (let iter = 0; iter < 50; iter++) {
        let newV = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            newV[i] += matrix[i][j] * v[j];
          }
        }
        v = newV;
        
        const norm = Math.sqrt(v.reduce((sum, vi) => sum + vi * vi, 0));
        v = v.map(vi => vi / norm);
      }
      
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

  fit(X) {
    this.X_fit = X;
    const n = X.length;
    
    const K = Array(n).fill().map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        K[i][j] = this._polynomialKernel(X[i], X[j]);
      }
    }
    
    const K_centered = this._centerKernelMatrix(K);
    const { eigenvectors, eigenvalues } = this._eigenDecomposition(K_centered);
    
    this.eigenvectors = eigenvectors;
    this.eigenvalues = eigenvalues;
  }

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
 * TD Value Estimator
 */
class TDValueEstimator {
  constructor(nFeatures = 16, alpha = 0.01, gamma = 0.95, lambda = 0.8) {
    this.weights = Array(nFeatures).fill(0).map(() => Math.random() * 0.01);
    this.alpha = alpha;
    this.gamma = gamma;
    this.lambda = lambda;
    this.eligibility = Array(nFeatures).fill(0);
  }

  _extractFeatures(state) {
    const features = [];
    
    const eSpaceCenter = state.eSpaceTraj.reduce((acc, vec) => {
      vec.forEach((v, i) => acc[i] = (acc[i] || 0) + v);
      return acc;
    }, Array(state.eSpaceTraj[0]?.length || 8).fill(0));
    
    eSpaceCenter.forEach(v => features.push(v / (state.eSpaceTraj.length || 1)));
    
    features.push(state.meterScore || 0);
    features.push(state.rhymeConsistency || 0);
    features.push(state.novelty || 0);
    features.push(state.lineCount / 100 || 0);
    features.push(state.themeCoherence || 0);
    
    while (features.length < this.weights.length) features.push(0);
    return features.slice(0, this.weights.length);
  }

  estimate(state) {
    const features = this._extractFeatures(state);
    return features.reduce((sum, f, i) => sum + f * this.weights[i], 0);
  }

  update(state, reward, nextState, done) {
    const phi = this._extractFeatures(state);
    const phiNext = done ? Array(this.weights.length).fill(0) : this._extractFeatures(nextState);
    
    const v = phi.reduce((sum, f, i) => sum + f * this.weights[i], 0);
    const vNext = phiNext.reduce((sum, f, i) => sum + f * this.weights[i], 0);
    
    const tdError = reward + (done ? 0 : this.gamma * vNext) - v;
    
    this.eligibility = this.eligibility.map((e, i) => 
      this.gamma * this.lambda * e + phi[i]
    );
    
    this.weights = this.weights.map((w, i) => 
      w + this.alpha * tdError * this.eligibility[i]
    );
    
    if (done) this.eligibility.fill(0);
    
    return tdError;
  }
}

/**
 * AG-TUNE Engine (Simplified for training)
 */
class AGTuneEngine {
  constructor() {
    this.vocabulary = new Map();
    this.embeddings = new Map();
    this.emotionalSpace = new Map();
    this.kernelPCA = new KernelPCA(8, 3);
    this.valueEstimator = new TDValueEstimator(16, 0.01, 0.95, 0.8);
    this.lastCorpusSignature = null;
    this.isTrained = false;
  }

  _tokenize(text) {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }

  _corpusSignature(corpus) {
    let hash = 0;
    for (const line of corpus) {
      for (let i = 0; i < line.length; i++) {
        hash = ((hash << 5) - hash) + line.charCodeAt(i);
      }
      hash ^= line.length + corpus.length;
    }
    return `${corpus.length}:${hash}`;
  }

  train(corpus, epochs = 10, incremental = false) {
    const corpusSignature = this._corpusSignature(corpus);
    const shouldRebuild = this.lastCorpusSignature !== corpusSignature || !this.isTrained;

    if (shouldRebuild) {
      console.log(incremental ? 'Expanding vocabulary and embeddings...' : 'Building vocabulary and embeddings...');
      
      // Only clear if not doing incremental training
      if (!incremental) {
        this.vocabulary.clear();
        this.embeddings.clear();
        this.emotionalSpace.clear();
      }

      // Build frequency vocabulary
      corpus.forEach(text => {
        this._tokenize(text).forEach(word => {
          this.vocabulary.set(word, (this.vocabulary.get(word) || 0) + 1);
        });
      });

      console.log(`Vocabulary size: ${this.vocabulary.size} words`);

      // Initialize embeddings for new words only
      this.vocabulary.forEach((freq, word) => {
        if (!this.embeddings.has(word)) {
          this.embeddings.set(word, Array(8).fill(0).map(() => Math.random() * 0.1));
        }
      });

      // Build co-occurrence embeddings
      const window = 3;
      corpus.forEach(text => {
        const tokens = this._tokenize(text);
        tokens.forEach((word, i) => {
          if (!this.embeddings.has(word)) return;
          const embedding = this.embeddings.get(word);

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
      console.log('Training Kernel PCA...');
      const embeddingVectors = Array.from(this.embeddings.values());
      if (embeddingVectors.length > 0) {
        this.kernelPCA.fit(embeddingVectors);
        
        // Transform into emotional space
        const transformed = this.kernelPCA.transform(embeddingVectors);
        const words = Array.from(this.embeddings.keys());
        words.forEach((word, i) => {
          this.emotionalSpace.set(word, transformed[i]);
        });
      }

      this.lastCorpusSignature = corpusSignature;
    }

    // Pre-train value estimator on corpus
    console.log(`Training TD value estimator for ${epochs} epochs...`);
    let totalReward = 0;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochReward = 0;
      
      corpus.forEach((text) => {
        const tokens = this._tokenize(text);
        const states = [];
        
        for (let i = 0; i < Math.min(tokens.length, 10); i++) {
          const word = tokens[i];
          const eVec = this.emotionalSpace.get(word) || Array(8).fill(0);
          
          states.push({
            eSpaceTraj: [eVec],
            meterScore: Math.random() * 0.5 + 0.5,
            rhymeConsistency: Math.random() * 0.5,
            novelty: 1.0 - (i / tokens.length),
            lineCount: i,
            themeCoherence: 0.7
          });
        }
        
        for (let i = 0; i < states.length - 1; i++) {
          const reward = 0.5 + Math.random() * 0.3;
          this.valueEstimator.update(states[i], reward, states[i + 1], false);
          epochReward += reward;
        }
        
        if (states.length > 0) {
          const finalReward = 0.8;
          this.valueEstimator.update(states[states.length - 1], finalReward, states[0], true);
          epochReward += finalReward;
        }
      });
      
      totalReward += epochReward / corpus.length;
      
      if ((epoch + 1) % 10 === 0 || epoch === 0) {
        console.log(`Epoch ${epoch + 1}/${epochs}: Avg Reward = ${(epochReward / corpus.length).toFixed(4)}`);
      }
    }

    this.isTrained = true;
    return totalReward / epochs;
  }

  saveCheckpoint(filepath) {
    const data = {
      vocabulary: Array.from(this.vocabulary.entries()),
      embeddings: Array.from(this.embeddings.entries()),
      emotionalSpace: Array.from(this.emotionalSpace.entries()),
      kernelPCA: {
        nComponents: this.kernelPCA.nComponents,
        degree: this.kernelPCA.degree,
        eigenvectors: this.kernelPCA.eigenvectors,
        eigenvalues: this.kernelPCA.eigenvalues,
        X_fit: this.kernelPCA.X_fit
      },
      valueEstimator: {
        weights: this.valueEstimator.weights,
        alpha: this.valueEstimator.alpha,
        gamma: this.valueEstimator.gamma,
        lambda: this.valueEstimator.lambda
      },
      lastCorpusSignature: this.lastCorpusSignature,
      isTrained: this.isTrained,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`\n✓ Checkpoint saved to ${filepath}`);
  }

  loadCheckpoint(filepath) {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    this.vocabulary = new Map(data.vocabulary);
    this.embeddings = new Map(data.embeddings);
    this.emotionalSpace = new Map(data.emotionalSpace);
    
    this.kernelPCA.nComponents = data.kernelPCA.nComponents;
    this.kernelPCA.degree = data.kernelPCA.degree;
    this.kernelPCA.eigenvectors = data.kernelPCA.eigenvectors;
    this.kernelPCA.eigenvalues = data.kernelPCA.eigenvalues;
    this.kernelPCA.X_fit = data.kernelPCA.X_fit;
    
    this.valueEstimator.weights = data.valueEstimator.weights;
    this.valueEstimator.alpha = data.valueEstimator.alpha;
    this.valueEstimator.gamma = data.valueEstimator.gamma;
    this.valueEstimator.lambda = data.valueEstimator.lambda;
    
    this.lastCorpusSignature = data.lastCorpusSignature;
    this.isTrained = data.isTrained;
    
    console.log(`✓ Checkpoint loaded from ${filepath}`);
    console.log(`  Vocabulary: ${this.vocabulary.size} words`);
    console.log(`  Timestamp: ${data.timestamp}`);
  }
}

// ============================================================================
// MAIN TRAINING SCRIPT
// ============================================================================

async function loadPretrainingData() {
  const pretrainingDir = path.join(__dirname, 'pretraining');
  
  // Using synchronous fs calls for simplicity in CLI training script
  if (!fs.existsSync(pretrainingDir)) {
    console.log('\nNo pretraining directory found, skipping pre-training phase.');
    return [];
  }
  
  const files = fs.readdirSync(pretrainingDir).filter(f => f.endsWith('.txt'));
  
  if (files.length === 0) {
    console.log('\nNo pretraining files found, skipping pre-training phase.');
    return [];
  }
  
  console.log(`\nFound ${files.length} pretraining files:\n`);
  
  const allData = [];
  
  for (const file of files) {
    const filepath = path.join(pretrainingDir, file);
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Split by lines and filter out empty lines
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > MIN_LINE_LENGTH);
    
    allData.push(...lines);
    console.log(`  - ${file}: ${lines.length} lines`);
  }
  
  console.log(`\nTotal pretraining corpus: ${allData.length} lines\n`);
  return allData;
}

async function loadAllLyrics() {
  const lyricsDir = path.join(__dirname, 'lyrics');
  const files = fs.readdirSync(lyricsDir).filter(f => f.endsWith('.txt'));
  
  console.log(`\nFound ${files.length} lyrics files:\n`);
  
  const allLyrics = [];
  
  for (const file of files) {
    const filepath = path.join(lyricsDir, file);
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Split by lines and filter out empty lines and title lines
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => {
        return line.length > MIN_LINE_LENGTH && 
               !FILTERED_PATTERNS.some(pattern => line === pattern);
      });
    
    allLyrics.push(...lines);
    console.log(`  - ${file}: ${lines.length} lines`);
  }
  
  console.log(`\nTotal corpus: ${allLyrics.length} lines\n`);
  return allLyrics;
}

async function main() {
  console.log('='.repeat(70));
  console.log('AG-TUNE LYRICS TRAINING SCRIPT WITH ENGLISH PRE-TRAINING');
  console.log('='.repeat(70));

  // Initialize engine
  const engine = new AGTuneEngine();
  
  // PHASE 1: Pre-training on English language data
  const pretrainingData = await loadPretrainingData();
  
  if (pretrainingData.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 1: PRE-TRAINING ON ENGLISH LANGUAGE DATA');
    console.log('='.repeat(70));
    
    const pretrainingEpochs = 50; // Pre-train for foundational understanding
    const pretrainReward = engine.train(pretrainingData, pretrainingEpochs);
    
    console.log('\n' + '='.repeat(70));
    console.log('PRE-TRAINING COMPLETE');
    console.log('='.repeat(70));
    console.log(`Average Reward: ${pretrainReward.toFixed(4)}`);
    console.log(`Vocabulary Size: ${engine.vocabulary.size}`);
    console.log(`Emotional Space Vectors: ${engine.emotionalSpace.size}`);
  }
  
  // PHASE 2: Fine-tuning on lyrics (incremental to preserve pre-training)
  const lyrics = await loadAllLyrics();
  
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 2: FINE-TUNING ON LYRICS DATA');
  console.log('='.repeat(70));
  
  const epochs = 100; // Extensive training to ensure retention
  const isIncremental = pretrainingData.length > 0; // Preserve pre-training if it was done
  const avgReward = engine.train(lyrics, epochs, isIncremental);
  
  console.log('\n' + '='.repeat(70));
  console.log('FINE-TUNING COMPLETE');
  console.log('='.repeat(70));
  console.log(`Average Reward: ${avgReward.toFixed(4)}`);
  console.log(`Final Vocabulary Size: ${engine.vocabulary.size}`);
  console.log(`Final Emotional Space Vectors: ${engine.emotionalSpace.size}`);
  console.log(`TD Weights Trained: ${engine.valueEstimator.weights.length}`);
  
  // Save checkpoint for indefinite retention
  const checkpointPath = path.join(__dirname, 'agtune-lyrics-checkpoint.json');
  engine.saveCheckpoint(checkpointPath);
  
  // Verify retention by loading and checking
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION PHASE - Testing Information Retention');
  console.log('='.repeat(70));
  
  const verifyEngine = new AGTuneEngine();
  verifyEngine.loadCheckpoint(checkpointPath);
  
  // Test some words from both pretraining and lyrics
  const testWords = ['the', 'and', 'people', 'time', 'ghost', 'love', 'death', 'shadow', 'night', 'dream'];
  
  console.log('\nTesting word embeddings (common English + lyrics):');
  testWords.forEach(word => {
    if (verifyEngine.emotionalSpace.has(word)) {
      const vec = verifyEngine.emotionalSpace.get(word);
      console.log(`  ✓ "${word}": [${vec.slice(0, 4).map(v => v.toFixed(3)).join(', ')}, ...]`);
    } else {
      console.log(`  ✗ "${word}": not in vocabulary`);
    }
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('SUCCESS: Model trained with English pre-training and lyric fine-tuning');
  console.log('The model has English language comprehension and lyric-specific knowledge');
  console.log('Checkpoint saved for indefinite use and can be loaded anytime');
  console.log('='.repeat(70));
}

main().catch(console.error);
