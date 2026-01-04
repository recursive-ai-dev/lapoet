# AG-TUNE Strategic Update Plan

This document outlines three major quarter-yearly scale updates envisioned for the AG-TUNE model, aimed at evolving it from a prototype to a production-grade neuro-symbolic poetry engine.

## 1. Deep-Linguistic Neuro-Symbolic Core (Selected for Implementation)
**Goal:** Replace shallow, hardcoded linguistic data with a robust, logic-driven generative engine.
*   **Current State:** Uses a tiny hardcoded grammar (~30 words) and a lookup table for rhymes (~16 words).
*   **Upgrade:** Implement a feature-based Context-Free Grammar (CFG) with agreement enforcement (Subject-Verb-Object consistency). Replace dictionary lookups with an algorithmic Grapheme-to-Phoneme (G2P) engine for dynamic rhyme and meter detection on *any* English word.
*   **Benefit:** Enables infinite vocabulary usage, grammatical correctness, and true poetic structure without relying on massive pre-trained datasets.

## 2. Hierarchical Narrative Planner
**Goal:** Enable the model to "think" in stories rather than just lines.
*   **Current State:** Generates line-by-line using a limited look-behind buffer.
*   **Upgrade:** Introduce a "Director" agent that plans a stanza-level emotional arc (e.g., "Stanza 1: Loss -> Stanza 2: Bargaining -> Stanza 3: Acceptance"). Use the Rete engine to enforce these high-level constraints during the beam search of each line.
*   **Benefit:** Poems will have a cohesive theme and narrative progression.

## 3. Cross-Modal Synesthetic Training
**Goal:** Ground the poem's imagery in sensory reality.
*   **Current State:** Embeddings are learned from text co-occurrence only.
*   **Upgrade:** Train the emotional embedding space using multimodal data (image-caption pairs or audio-lyrics pairs). Map visual features (brightness, color entropy) to poetic features.
*   **Benefit:** The model could generate poetry based on an image or a melody, with grounded metaphors (e.g., describing "yellow" not just as a word, but as a sensation linked to the trained visual concept).

---

## Implementation Selection
We will implement **Update #1: Deep-Linguistic Neuro-Symbolic Core**. This is the most critical foundation; without a robust way to understand and generate language structure, higher-level planning or multimodal inputs cannot be effectively expressed. This update effectively "productionizes" the core generation capability.
