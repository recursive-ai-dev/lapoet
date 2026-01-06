# WE-CHOSE

## Objective
Document the three-perspective planning method (CEO, Junior Dev, End Customer) applied to the OpenRouter PR review workflow, and justify the selected implementation choices.

## Perspective 1: CEO (Risk, Cost, Operational Stability)
- **Primary concern:** Predictable spend, minimal compliance risk, and a measurable review process.
- **Decision mapping:**
  - *Free-only model enforcement* aligns to strict cost control.
  - *Diff size bounds* ensure predictable execution time.
  - *Idempotent comment updates* avoid clutter and maintain professional output.
- **Rationale:** These choices reduce operational variance and prevent unwanted charges.

## Perspective 2: Junior Dev (Clarity, Maintainability, Safe Defaults)
- **Primary concern:** Easy to understand, easy to debug, minimal surprise behavior.
- **Decision mapping:**
  - *Explicit truncation flag* makes behavior visible when diff is cut.
  - *Label creation before use* prevents failures when labels are missing.
  - *Regex verdict parsing with fixed tokens* keeps the system predictable.
- **Rationale:** The workflow is easy to run, and failures are explicit and actionable.

## Perspective 3: End Customer (PR Author / Reviewer Experience)
- **Primary concern:** Helpful, concise feedback without spam.
- **Decision mapping:**
  - *Structured prompt sections* yield consistent, scannable reviews.
  - *Single comment with update marker* avoids multiple noisy comments.
  - *Optional auto-labels* improve triage visibility in the UI.
- **Rationale:** Reviews remain readable and actionable, improving developer throughput.

## Combined Choice Justification
The chosen implementation is a synthesis:
- **CEO:** Free-only model lock and bounded inputs ensure safe, predictable costs.
- **Junior Dev:** Deterministic steps and explicit guards minimize fragility.
- **End Customer:** Clear, stable feedback format improves practical utility.

This combination maximizes safety, maintainability, and user impact without sacrificing correctness.
# Perspective Selection

## Purpose
Document the three-perspective planning approach for the formatting adjustment in `UPDATES_STRATEGY.md` and why the chosen path preserves clarity and maintainability.

## Perspectives
### CEO Perspective
- **Goal:** Maintain clear, professional documentation with consistent formatting.
- **Concern:** Small formatting inconsistencies can reduce perceived quality in strategy docs.

### Junior Developer Perspective
- **Goal:** Apply minimal, safe changes without altering meaning.
- **Concern:** Avoid unintended edits that could alter technical intent.

### End Customer Perspective
- **Goal:** Readable, uniform formatting that communicates project direction clearly.
- **Concern:** Inconsistent formatting distracts from content and reduces trust.

## Decision
- **Chosen approach:** Minimal, localized formatting normalization.
- **Why:** Aligns with all three perspectives by improving readability while preserving meaning and reducing risk.
- **Mapped logic chain reference:** LOGIC-MAP.md (Steps 1–3).

## Perspective Selection: Linguistic Engine & Corpus Loading

### CEO Perspective
- **Goal:** Reduce risk of low-quality generation outputs while keeping runtime cost bounded.
- **Choice:** Deterministic grapheme tokenization and lexicon-backed adverbs reduce unpredictable grammar drift.

### Junior Developer Perspective
- **Goal:** Keep logic transparent and maintainable with clear entry selection.
- **Choice:** Centralized `_selectEntry` for lexicon filtering and explicit transitivity branching makes behavior easy to trace.

### End Customer Perspective
- **Goal:** Generate more natural sentences and better phonetic analysis for poetry.
- **Choice:** Silent-e handling, vowel-team parsing, and real lyric file ingestion yield higher fidelity output.

### Combined Choice Justification
- **CEO:** Deterministic processing lowers variance and supports stable results.
- **Junior Dev:** Shared selection utilities minimize duplication and debugging time.
- **End Customer:** Higher phonetic and grammatical coherence improves usability.

**Mapped logic chain reference:** LOGIC-MAP.md (Steps 1–3, Linguistic Engine & Corpus Loading).

# Perspective Selection: Deterministic Seeding & RNG Propagation

### CEO Perspective
- **Goal:** Provide repeatable outcomes for demos, testing, and stakeholder review.
- **Choice:** Single seeded RNG enables consistent outputs when `?seed=` is supplied.

### Junior Developer Perspective
- **Goal:** Make randomness easy to reason about and debug.
- **Choice:** Central RNG injection removes hidden `Math.random()` usage and simplifies tracing.

### End Customer Perspective
- **Goal:** Allow users to reproduce poems or training runs reliably.
- **Choice:** Seed parsing accepts numeric and string values without requiring new UI controls.

### Combined Choice Justification
- **CEO:** Repeatable results reduce demo risk and simplify acceptance validation.
- **Junior Dev:** Shared RNG path avoids fragmented randomness sources.
- **End Customer:** Reproducible outputs improve trust and usability.

**Mapped logic chain reference:** LOGIC-MAP.md (Steps 1–3, Deterministic Seeding & RNG Propagation).
