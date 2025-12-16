# AG-TUNE (LaPoet): A Neuro-Symbolic Generative Poetry Engine
### © 2025 Damien Davison & Michael Maillet & Sacha Davison
### Recursive AI Devs  
Licensed under the Apache License, Version 2.0

---

### ***A hybrid of algorithmic aesthetics, linguistic reasoning, and emotional computation.***

AG-TUNE (Aesthetic Gradient Tuning Engine) is a **neuro-symbolic poetry generator** that blends classical algorithmic reasoning with modern generative heuristics. It produces verses that follow **emotional arcs, metrical rhythm, syntactic correctness, and aesthetic reward functions**, rather than relying on large transformer-based text models.

Where traditional poetry generators imitate language statistically, AG-TUNE **constructs poetry from first principles**, guided by:

* Mathematical embeddings

* Rule-based structure

* Reinforcement learning

* Spectral rhythm analysis

* Multi-objective heuristic search

* linguistic constraint propagation

This engine doesn't just output text.  
 It **thinks poetically**.

---

# **Features**

### **🔹 Kernel PCA Emotional Embedding**

Words are projected into an emotional-semantic space using a polynomial kernel.  
 This allows the model to track *emotion trajectories* across lines and stanzas.

### **🔹 Spectral Rhythm Analyzer (FFT-based)**

AG-TUNE transforms candidate lines into stress patterns, applies FFT, and evaluates rhythmic coherence.  
 This forces lines to exhibit **recognizable poetic meter** without hardcoding specific forms.

### **🔹 Reinforcement-Driven Aesthetic Value**

A TD(λ) reinforcement learner assigns a value score to each line based on:

* Emotional continuity

* Surprise

* Meter quality

* Cohesion

* Novelty

Poetry becomes **a policy**, not a guess.

### **🔹 Rete Rule Engine for Constraints**

Grammar rules, rhyming constraints, and thematic restrictions are encoded through a Rete-based forward chaining engine.  
 This ensures **internal consistency** without brute forcing.

### **🔹 CYK Parser for Grammatical Validation**

Every candidate line must be syntactically valid according to a CFG.  
 Invalid structures are filtered immediately.

### **🔹 Beam Search with Multi-Objective Scoring**

Token generation uses a custom beam search that weighs:

* Emotional alignment

* Meter score

* Aesthetic reward

* Rule satisfaction

* Grammar validity

* Novelty via cycle detection

It is essentially **a cooperative committee of algorithms**, all trying to agree on the next word.

### **🔹 Cycle Detection to Prevent Collapse**

Floyd’s Tortoise-and-Hare algorithm prevents repetitive loops or stagnation.

### **🔹 Interactive React Interface**

A modern UI displays:

* Emotional trajectory graphs

* Beam search exploration trees

* Rhythm spectral output

* Rule activations

* Aesthetic value gradients

The poet becomes **something you can watch think**.

---

# **System Architecture**

\+-----------------------------+  
| Emotion Embedding (Kernel PCA)  
\+-----------------------------+  
                ↓  
\+-----------------------------+  
| Rhythm Analyzer (FFT)  
\+-----------------------------+  
                ↓  
\+-----------------------------+  
| Constraint Engine (Rete)  
\+-----------------------------+  
                ↓  
\+-----------------------------+  
| Syntax Filter (CYK Parser)  
\+-----------------------------+  
                ↓  
\+-----------------------------+  
| Aesthetic Value Model (TD(λ))  
\+-----------------------------+  
                ↓  
\+-----------------------------+  
| Multi-Objective Beam Search  
\+-----------------------------+  
                ↓  
\+-----------------------------+  
| React Visualization Layer  
\+-----------------------------+

AG-TUNE is **not** one algorithm.  
 It is a **coalition** of reasoning systems negotiating the next word.

---

# **Installation**

npm install  
npm run dev

AG-TUNE is fully client-side and requires no server runtime.

---

# **Training**

AG-TUNE includes a comprehensive two-phase training system that learns from English pre-training data and lyrics:

```bash
# Train with English pre-training + lyrics fine-tuning
npm run train

# Verify the model retains information indefinitely  
npm run verify

# Test core algorithms
npm run test-engine
```

The training process:
* **Phase 1: Pre-training** on 373 lines of English text (1,122 unique words)
  * Builds foundational language comprehension
  * Learns common vocabulary and grammatical patterns
* **Phase 2: Fine-tuning** on 847+ lines of lyrics (expanding to 2,329 unique words)
  * Preserves English foundation while adding lyric-specific knowledge
  * Builds co-occurrence word embeddings
  * Trains Kernel PCA for emotional space mapping
  * Optimizes TD-lambda value estimator (100 epochs)
* Saves checkpoint for indefinite reuse

**The model retains all learned information and can be loaded anytime.**

See [TRAINING.md](TRAINING.md) for training documentation and [PRETRAINING.md](PRETRAINING.md) for details on the pre-training system.

---

# **Configuration**

Key parameters include:

* `kernelDegree`: degree of the polynomial kernel for emotional PCA

* `beamWidth`: number of candidate lines

* `fftThreshold`: sensitivity of rhythm detection

* `lambda`: eligibility trace decay for aesthetic learning

* `constraintProfile`: rule set passed to the Rete engine

Modify these in `config.js` to evolve the poet's personality.

---

# **Philosophy**

AG-TUNE explores the question:

**What if poetry were a computational process rather than a statistical artifact?**

Instead of training on massive corpora, AG-TUNE reimagines poetry as:

* An emotional manifold

* A rhythmic signal

* A logical structure

* A reward-driven path

* A symbolic negotiation

This model does not imitate poets.  
 It **behaves like one**.

---

# **Research Inspiration**

AG-TUNE draws influence from:

* Neural symbolic reasoning

* Reinforcement learning with eligibility traces

* Constraint programming

* Formal grammar theory

* Spectral audio analysis

* Multi-objective optimization

If you build on this work, please cite the repository.

---

**Contributing**

Contributions are welcome, especially in the areas of:

* New constraint rules

* Alternative rhythm detectors

* Additional emotional embedding models

* Visualization components

* Aesthetic reward shaping

---

# **License**

Apache-2.0

