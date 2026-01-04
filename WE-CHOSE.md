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
