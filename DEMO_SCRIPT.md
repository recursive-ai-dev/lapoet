# AG-TUNE Live Demo Script (7 Minutes)

## Setup (Already Done) ✓
- Server running at: http://localhost:3000/
- All algorithms implemented with real math
- No mock data, no placeholders

---

## Demo Flow

### 1. **Introduction (30 seconds)**
"This is AG-TUNE - a neuro-symbolic poetry engine that generates poetry using actual algorithms, not neural networks."

**Show:** Header with title and description

---

### 2. **Show Training Panel (1 minute)**

**Point out:**
- File upload for custom training corpus
- Corpus size display (starts with 10 embedded lines)
- Epoch slider (controls training iterations)
- Real-time metrics during training

**Key Message:** "This uses real distributional semantics, not pre-trained word vectors"

---

### 3. **Live Training Demo (1.5 minutes)**

**Steps:**
1. Click "Train Model"
2. Watch progress bar fill
3. **Show real metrics updating:**
   - Average Reward (changes each epoch)
   - Epochs Completed counter
   - Vocabulary Size (extracted from corpus)

**Explain while training:**
"The engine is:
- Computing co-occurrence embeddings
- Running Kernel PCA for emotional space
- Training TD-lambda value estimator
- All real linear algebra and calculus"

---

### 4. **Show Internal States (1 minute)**

**Scroll to visualizations:**

**Emotional Space:**
- "These are actual 8D vectors from polynomial kernel PCA"
- Show different words have different values
- Point out: "No word2vec, no GloVe - computed from scratch"

**Value Estimator Weights:**
- "These 16 weights were learned via temporal difference learning"
- Show the bar graph changes after training
- "Real gradient descent, real backpropagation"

---

### 5. **Poetry Generation (2 minutes)**

**Steps:**
1. Enter prompt: "whispers in the moonlight"
2. Adjust beam width to 7
3. Set lines to 4
4. Click "Generate Poem"

**Explain while generating:**
"The engine is now:
- Running A* beam search
- Checking grammar with CYK parser
- Analyzing rhythm with FFT
- Avoiding repetition with Floyd cycle detection
- Evaluating aesthetic value with learned V(s)"

**Show generated poem:**
- Read it aloud
- Point out it follows meter
- Show generation metrics (M, N, V values)

---

### 6. **Prove It's Real Math (1 minute)**

**Open browser console (F12):**
- Show no errors
- Explain: "All computation happens client-side in JavaScript"

**Alternative - Run test script:**
```bash
node test-engine.js
```

**Show output:**
- Kernel PCA working ✓
- Cycle detector working ✓
- FFT meter analyzer working ✓

**Key Point:** "Every algorithm outputs real numerical results, no simulation"

---

### 7. **Advanced Features (30 seconds)**

**Quick mention:**
- Rete rule engine enforces constraints
- Multi-objective scoring (meter + theme + novelty)
- Online learning (TD updates during generation)
- File upload for custom poetry styles

---

## Closing Statement

"AG-TUNE demonstrates that poetry generation doesn't require massive neural networks. With classical algorithms - PCA, FFT, CYK parsing, reinforcement learning - we can create structured, metrically sound poetry from first principles."

**Total Time: ~7 minutes**

---

## Backup Answers (If Asked)

**Q: Is this using GPT or transformers?**
A: No. Zero neural networks. Pure algorithmic generation with Kernel PCA, TD learning, and beam search.

**Q: How does training work?**
A: It builds co-occurrence embeddings from corpus, transforms them via polynomial kernel PCA into emotional space, then trains a TD-lambda value estimator to predict aesthetic reward.

**Q: Can it scale?**
A: Yes - add more corpus via file upload. The algorithms are O(n³) for CYK, O(n log n) for FFT, both manageable for poetry-length inputs.

**Q: What's the novelty?**
A: Multi-objective poetry generation combining 7 different algorithms (KPCA, TD, Rete, CYK, FFT, Floyd, Beam Search) in a unified framework without neural networks.

---

## Technical Details Ready

- Training process: See `TRAINING_EXPLAINED.md`
- Source code: All in `src/App.jsx` (1,350 lines)
- Algorithms documented inline with citations to theory

**Good luck with the presentation! 🎯**
