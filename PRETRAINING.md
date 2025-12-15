# AG-TUNE Pre-training Documentation

## Overview

AG-TUNE now includes an English language pre-training phase that provides foundational language comprehension before fine-tuning on specialized lyrics. This two-phase approach significantly improves the model's ability to generate coherent, grammatically correct text.

## Why Pre-training?

Previously, AG-TUNE was trained only on ~847 lines of custom lyrics (1,675 unique words). While this provided domain-specific knowledge, it lacked:

* Common English vocabulary and word relationships
* Basic sentence structures and grammatical patterns
* General language comprehension for coherent generation

With pre-training, the model first learns from 373 lines of diverse English text (1,122 unique words) covering:

* Simple declarative sentences
* Common narrative structures
* Dialogue patterns
* Everyday phrases and expressions

This foundation is then enriched with lyric-specific vocabulary and patterns during fine-tuning.

## Pre-training Data

The pre-training corpus consists of four files in the `pretraining/` directory:

### english-foundation.txt (105 lines)
Basic English sentences covering:
* Natural phenomena (sun, moon, rain, stars)
* Common objects and places (house, books, mountains, ocean)
* Abstract concepts (time, love, truth, wisdom, hope)
* Simple subject-verb-object structures

### english-narrative.txt (96 lines)
Narrative structures featuring:
* Character actions and descriptions
* Temporal progressions (morning, afternoon, evening, night)
* Spatial descriptions (locations, places, movements)
* Professional activities and settings

### english-dialogue.txt (90 lines)
Conversational patterns including:
* Question and answer pairs
* Polite exchanges and greetings
* Topic transitions
* Narrative dialogue structures

### english-common-phrases.txt (82 lines)
Frequently used expressions:
* Greetings and farewells
* Common courtesy phrases
* Idiomatic expressions
* Conversational connectors

## Training Process

### Two-Phase Training

1. **Phase 1: Pre-training on English Data**
   - Loads all `.txt` files from `pretraining/` directory
   - Trains for 50 epochs on general English text
   - Builds vocabulary of ~1,122 common English words
   - Establishes baseline language comprehension

2. **Phase 2: Fine-tuning on Lyrics**
   - Loads all `.txt` files from `lyrics/` directory
   - Trains for 100 epochs on specialized lyrics
   - Expands vocabulary to ~2,329 words (preserving pre-trained words)
   - Learns domain-specific patterns while maintaining English foundation

### Incremental Training

The training system now supports incremental learning:

```javascript
// Pre-train (builds from scratch)
engine.train(pretrainingData, 50, false);

// Fine-tune (preserves existing vocabulary)
engine.train(lyricsData, 100, true);
```

When `incremental=true`:
* Existing vocabulary is preserved and expanded
* New words are added to the vocabulary
* Embeddings for existing words are updated but not discarded
* Total vocabulary is the union of both corpora

## Running Pre-trained Model

### Command Line Training

```bash
# Run the complete two-phase training
npm run train

# This will:
# 1. Pre-train on files in pretraining/
# 2. Fine-tune on files in lyrics/
# 3. Save checkpoint with both vocabularies
```

### Using in Web UI

1. Start the development server:
```bash
npm run dev
```

2. Open http://localhost:5173 in your browser

3. Click "Load Checkpoint" and upload `agtune-lyrics-checkpoint.json`

4. The model now has both English comprehension and lyric-specific knowledge

## Results

### Vocabulary Statistics

| Phase | Lines | Unique Words | Emotional Vectors |
|-------|-------|--------------|-------------------|
| Pre-training | 373 | 1,122 | 1,122 |
| Fine-tuning | 847 | 2,329 | 2,329 |
| **Total** | **1,220** | **2,329** | **2,329** |

### Improvements

With pre-training, the model now understands:

* ✅ Common English articles (the, a, an)
* ✅ Frequent conjunctions (and, but, or)
* ✅ Basic prepositions (in, on, at, with, through)
* ✅ Common verbs (walk, run, stand, speak, think)
* ✅ Everyday nouns (people, time, house, day, water)
* ✅ Simple sentence structures (Subject-Verb-Object)
* ✅ Grammatical patterns (past/present tense agreement)

Plus the original lyric-specific vocabulary:
* 🎵 Artistic expressions and metaphors
* 🎵 Emotional language and imagery
* 🎵 Poetic devices and structures

## Adding Custom Pre-training Data

You can add your own pre-training data:

1. Create a `.txt` file in the `pretraining/` directory
2. Add one sentence or line per row
3. Use clear, grammatically correct English
4. Focus on vocabulary you want the model to understand
5. Run `npm run train` to include your data

### Guidelines for Pre-training Data

**Do:**
* Use simple, clear sentences
* Cover diverse vocabulary
* Include common grammatical patterns
* Maintain consistent quality

**Don't:**
* Add very short lines (< 10 characters are filtered)
* Use obscure or technical jargon excessively
* Include ungrammatical text
* Duplicate content unnecessarily

## Advanced Usage

### Custom Two-Phase Training

```javascript
import { AGTuneEngine } from './src/App.jsx';

const engine = new AGTuneEngine();

// Phase 1: Pre-train on your data
const englishData = loadYourEnglishCorpus();
engine.train(englishData, 50, false);

// Phase 2: Fine-tune on domain-specific data
const domainData = loadYourDomainCorpus();
engine.train(domainData, 100, true);

// Save combined model
engine.saveCheckpoint('custom-checkpoint.json');
```

### Adjusting Training Balance

You can adjust epochs for each phase:

```javascript
// More pre-training, less fine-tuning (better English, less domain-specific)
engine.train(englishData, 100, false);
engine.train(domainData, 50, true);

// Less pre-training, more fine-tuning (more domain-specific, less English)
engine.train(englishData, 25, false);
engine.train(domainData, 150, true);
```

## Performance Considerations

### Training Time

* **Pre-training (373 lines, 50 epochs)**: ~10-15 seconds
* **Fine-tuning (847 lines, 100 epochs)**: ~15-25 seconds
* **Total**: ~25-40 seconds on typical hardware

### Memory Usage

* **Pre-training vocabulary**: ~1,122 words
* **Fine-tuned vocabulary**: ~2,329 words (1,122 + 1,207 new)
* **Checkpoint size**: ~2.5 MB (increased from ~1.7 MB)
* **Runtime memory**: ~50-80 MB (increased from ~30-50 MB)

### Vocabulary Limit

The system has a maximum vocabulary size of 2,500 words to keep the kernel matrix computationally manageable. With pre-training + lyrics, we use ~2,329 words (93% of capacity), leaving room for additional expansion.

## Troubleshooting

### No Pre-training Directory

If the `pretraining/` directory doesn't exist:
* The training script will skip Phase 1
* Training will proceed with only lyrics (legacy behavior)
* Create the directory and add `.txt` files to enable pre-training

### Vocabulary Not Expanding

If fine-tuning doesn't expand vocabulary:
* Check that `incremental=true` is passed to the second `train()` call
* Verify lyrics files are loading correctly
* Ensure lyrics contain words not in pre-training data

### Poor Generation Quality

If generated text is incoherent:
* Increase pre-training epochs (try 75-100)
* Add more diverse pre-training data
* Adjust beam width during generation (try 7-10)
* Ensure checkpoint was saved after both phases

## Citation

If you use the AG-TUNE pre-training system in your research:

```
Davison, D., Maillet, M., & Davison, S. (2025).
AG-TUNE: A Neuro-Symbolic Generative Poetry Engine with English Pre-training.
Recursive AI Devs. https://github.com/recursive-ai-dev/lapoet
```

## License

Apache-2.0 License - See LICENSE file for details.

---

**Pre-training gives AG-TUNE a solid English foundation while preserving its poetic soul.** 🎯✨
