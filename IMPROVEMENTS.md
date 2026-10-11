# AG-TUNE Model Improvement Audit — 28 Implemented Improvements

Audit date: 2026-10-10. Scope: the AG-TUNE model (core algorithm classes in
`src/App.jsx` → now `src/engine.js`, plus `src/UniversalLinguisticEngine.js`).

Each item below was identified, then implemented and verified via
`test-model-smoke.js` (new) and the existing test suite.

---

## Architecture & testability

**1. Model extracted out of the JSX file.**
All model classes (KernelPCA, TDValueEstimator, LFG, Rete, Floyd, CYK, FFT,
AGTuneEngine) lived inside `src/App.jsx`, a JSX/React file that Node cannot
import — so the model was untestable in isolation. They now live in a pure-JS
module `src/engine.js`; `App.jsx` imports `AGTuneEngine` and renders UI only.

**2. End-to-end smoke test for the real model.**
Added `test-model-smoke.js` (wired into `npm run test-all`): trains the real
engine on the lyrics corpus, generates poems, checks determinism, round-trips
checkpoints, and loads the shipped legacy checkpoint. Previously no test
imported the actual model classes (existing tests all carried private copies).

## Kernel PCA

**3. Proper kernel-PCA dual coefficients.**
`transform()` projected with raw eigenvectors. Standard kernel PCA requires
α = v/√λ; alphas are now computed at fit time (degenerate λ excluded).

**4. Out-of-sample kernel centering.**
`transform()` used uncentered kernel rows for new points, biasing every
projection. Fit now stores column means + grand mean and transform centers
each new row: K̃(x,xⱼ) = K(x,xⱼ) − rowMean(x) − colMeanⱼ + grandMean.

**5. Robust eigendecomposition.**
If the deflated random start collapsed to ~0 the code kept a zero vector and
emitted garbage components. Now: re-sample collapsed starts, stop when the
residual subspace is numerically empty, skip degenerate eigenvalues, and sort
components by descending eigenvalue.

**6. Convergence-aware power iteration.**
Fixed 50 sweeps per component regardless of convergence. Now early-stops on
Rayleigh-quotient change ≤ 1e-8 (bounded by 100 iterations).

**7. KPCA performance.**
(a) Kernel matrix is symmetric — only the upper triangle is computed.
(b) Vocabulary is batch-transformed in one call instead of one
`transform([word])` per word (2,329 separate passes before).
(c) Fit basis is capped at a stratified subsample (512) so the
eigendecomposition no longer scales as vocab² (2329² → 512²).

**8. Full embedding dimensionality.**
Only the first 12 of 64 co-occurrence dimensions were fed to KPCA
(`emb.slice(0, 12)`). The full 64-dim vector is now used.

## Training & embeddings

**9. Co-occurrence embeddings encoded corpus position, not context.**
`embedding[j % embedding.length] += 0.1` wrote neighbor counts into the
*sequence position* index. Now the *neighbor word identity* (plus left/right
direction) is feature-hashed into the embedding dimension — an actual
distributional embedding.

**10. Embedding normalization + frequency table.**
Embeddings are L2-normalized after accumulation, and a unigram frequency
table (`engine.frequencies`) is kept for generation priors.

**11. `epochs` parameter actually honored.**
`train(corpus, epochs)` ran exactly one TD pass — the loop iterated corpus
lines and mislabeled the line index as `epoch`. Now runs `epochs` passes.

**12. NaN poisoning from empty token lists.**
`_calculateRepetitionScore([])` computed `0/0 = NaN`, which propagated into
TD features/weights whenever a corpus line had no word tokens. Guarded.

**13. Real rhyme-consistency feature.**
`_checkRhymeConsistency` returned 1.0 for *any* analyzable word (a constant,
zero-information feature). It now tracks line-ending words and returns the
phonetic rhyme similarity between consecutive line endings.

**14. Bigram transition index.**
Training now collects adjacent-word (bigram) counts over the corpus, powering
a real contextual language-model prior at generation time.

## TD learner, RNG, checkpoints

**15. Consistent TD feature layout.**
The emotional-trajectory block was assumed to be 12 dims while the estimator
was constructed with 24 weights — when `kpca.nComponents ≠ 12` (e.g. 8 in the
shipped checkpoint), meter/rhyme/novelty features landed on wrong weight
indices. The trajectory block is now padded/truncated to `kpca.nComponents`
and the estimator size is exactly `nComponents + 5`.

**16. TD numerical guards.**
Updates now bail out on non-finite rewards/TD errors instead of corrupting
weights with NaN/Infinity; features are sanitized to finite numbers.

**17. LFG zero-seed degeneracy.**
Seeds divisible by 2147483647 (including `0`) initialized an all-zero state;
`next()` then returned 0 forever. The seed is now normalized to
[1, 2147483646] (Park–Miller requirement).

**18. Checkpoint RNG-state sanitization.**
Loaded RNG state is now coerced to integers in range, indices taken mod 55,
and an all-zero state triggers a deterministic reseed instead of a dead RNG.

**19. Legacy checkpoint support.**
`loadCheckpoint` required `version === 1`, but the repo's shipped
`agtune-lyrics-checkpoint.json` is the `train-lyrics.js` format (`kernelPCA`
key, `[word, freq]` vocabulary, no version) — the UI "Upload Checkpoint"
button rejected it. The loader now accepts v2, v1, and the legacy format.

## Constraints

**20. Rete rule semantics were inverted.**
Conditions gate *matching*, but `syllableLimit`/`avoidRepetition` encoded
their checks as conditions with `() => true` actions — when the check failed
the rule simply didn't match, so violations were never reported and no word
was ever rejected. Applicability now lives in conditions, pass/fail in
actions, and `generateLine` acts on violations by falling through to the next
beam candidate instead of silently re-drawing the same one.

**21. Target-aware syllable constraint.**
The rule hardcoded 8–10 syllables regardless of the requested line length; it
now checks `|syllableCount − targetSyllables| ≤ tolerance` via facts.

**22. Rete alpha network actually used.**
`alphaNodes` were built and never consulted. Conditions now map onto shared
alpha nodes (deduped by key+test) whose results are memoized per evaluation.

**23. Correct repetition/cycle detection.**
The "Floyd" detector compared single token equality at tortoise/hare offsets
(false positives on incidental repeats, broken cycle-length math). Replaced
with a correct trailing-periodicity check: the smallest period `p` such that
the last `2p` tokens are two full repetitions — correct length, far fewer
false positives.

## Analysis: meter, parser, phonetics

**24. FFT meter analyzer fixed.**
Three bugs: (a) the DC component dominated the spectrum (mean is now
removed); (b) the Nyquist bin was excluded (`slice(0, n/2)`) although a
perfect alternating (iambic) pattern peaks *exactly* there — iambic lines
scored 0.5 instead of ~1; (c) the target bin was the raw pattern length
instead of `n/period`. Scoring is now spectral-energy concentration at the
target bin ±1.

**25. CYK parser: n-ary productions + empty input.**
Productions longer than 2 symbols were silently dropped, so the grammar's own
`Det Adj N`, `V NP PP`, … forms could never parse (every generated line
scored the 0.3 syntax fallback). The parser now supports any RHS length via
span-splitting DP, and `parse([])` returns false instead of vacuous true.

**26. Grammar cleanup + sentence post-processing.**
Removed the redundant duplicate `Prep`/`P` terminal blocks, aligned the flat
grammar with the generator's actual productions, and `generateStructure` now
returns a capitalized, punctuated sentence.

**27. G2P phonetics fixes.**
`oy`/`oi` produced `'O Y'` (space-separated), which the vowel-run syllable
counter counted as **two** syllables ("boy" → 2). Now a single `OY` unit, and
`estimateStress` groups vowel runs into one syllable. Also, word-internal `y`
between consonants ("myth", "system") was left as a consonant, dropping a
syllable; it is now phonemicized as a vowel.

## Generation

**28. Real beam search + real priors + working generation loop.**
`generateLine` kept a beam but committed to a single path each step (pick one
of the top-2, extend only that), and its g(n) term was `-log(rng + 0.01)` —
pure noise. The rebuild:
- multiple hypotheses expanded/pruned per step, with end-of-line Rete checks
  selecting the best constraint-passing completion;
- path cost uses an interpolated unigram+bigram language-model prior
  (tempered, bounded, conditioned on the last 3 context words, with a flat
  unigram/uniform fallback when no bigram evidence exists so function words
  don't dominate line openings);
- tokenizer keeps contractions intact (`i'm`, `love's`) and normalizes
  typographic apostrophes — previously `It’s` tokenized to `it` + `s`;
- candidate pool is the union of top-prior and top-emotional-proximity words,
  with emotional alignment to both the previous word and the prompt's
  emotional anchor;
- graded rhyme bonus (phonetic suffix similarity, not exact-match-only),
  syllable-proximity shaping, and a global repetition penalty that prevents
  beam collapse onto stock phrases across lines;
- the arbitrary 2–10 character word filter is gone; word analyses and
  vocabulary arrays are memoized.

---

### Verification

```bash
npm run test-all          # includes the new test-model-smoke
node test-model-smoke.js  # model-specific end-to-end checks
npm run build             # UI still builds (App.jsx imports ./engine)
```
