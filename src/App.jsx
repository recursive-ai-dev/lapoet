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
import { AGTuneEngine, hashSeedString } from './engine.js';

// The model core (Kernel PCA, TD(λ), Rete, CYK, FFT meter, AGTuneEngine)
// lives in ./engine.js — a pure-JS module testable directly under Node.

const resolveSeedFromLocation = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed');
  if (seedParam === null) return null;
  const normalized = seedParam.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return Math.floor(parsed);
  return hashSeedString(normalized);
};

// ============================================================================
// REACT UI COMPONENT
// ============================================================================

/**
 * AG-TUNE Poet React Component
 * Interactive interface for training and poetry generation
 */
export default function AGTunePoet() {
  const [engine] = useState(() => {
    const seed = resolveSeedFromLocation();
    return new AGTuneEngine(Number.isFinite(seed) ? seed : Date.now());
  });
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
