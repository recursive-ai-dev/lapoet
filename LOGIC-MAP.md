# LOGIC-MAP

## Scope
This document maps the production workflow implementation for the OpenRouter PR review GitHub Action. It provides a logic chain that explains why each step exists, what invariant it enforces, and how it proves correctness under bounded failure modes.

## Logic Chain Summary
1. **Trigger & Permissions**
   - **Why:** A PR review requires `pull_request` triggers and `pull-requests: write` to comment. `contents: read` is needed to checkout for context.
   - **Invariant:** Action only runs on PR updates; permissions are minimal but sufficient.

2. **Diff Acquisition with Size Bound**
   - **Why:** The diff is the sole source of truth; size bound prevents prompt overflow and failure.
   - **Invariant:** Prompt size remains bounded by `MAX=150000` bytes.
   - **Proof Sketch:** Let `S` be diff size. If `S <= MAX`, diff is unchanged. If `S > MAX`, the pipeline sets `S' = MAX`, thus `S' <= MAX` by construction.

3. **Free-Only Model Lock**
   - **Why:** Enforces strict cost control and prevents accidental paid usage.
   - **Invariant:** Model string ends with `:free` or job fails fast.
   - **Proof Sketch:** For any model string `M`, the step enforces `M` endsWith `:free`. If not, exit non-zero. Therefore any downstream call uses only `:free` models.

4. **Prompt Construction with Truncation Disclosure**
   - **Why:** Review quality depends on context; disclosure prevents overconfidence when truncated.
   - **Invariant:** The prompt includes `Diff truncated: true|false`.
   - **Proof Sketch:** `DIFF_TRUNCATED` is propagated from the diff step outputs; the prompt concatenation is a total function of its inputs, so the flag always appears.

5. **OpenRouter Request Validity**
   - **Why:** The LLM call must be deterministic in structure for consistent parsing.
   - **Invariant:** Request JSON always includes `model`, `messages`, and deterministic system prompt.
   - **Proof Sketch:** `jq -n` builds JSON from fixed keys and inputs. Missing or invalid content triggers an explicit failure by checking the response.

6. **Response Validation**
   - **Why:** Empty responses should fail the workflow to prevent posting meaningless comments.
   - **Invariant:** `review.md` is written only if response content exists.
   - **Proof Sketch:** If response content is empty or `null`, the step exits with code 1 before writing output, so no downstream step uses invalid content.

7. **Labeling Based on Verdict**
   - **Why:** Translates model verdict into triage labels with deterministic mapping.
   - **Invariant:** Labels are created if missing and only applied when a verdict is detected.
   - **Proof Sketch:** The verdict regex only admits `APPROVE`, `REQUEST_CHANGES`, `COMMENT_ONLY`. If no match, the script returns early; otherwise, it ensures label existence before applying.

8. **Idempotent Comment Posting**
   - **Why:** Avoids spam by updating an existing bot comment.
   - **Invariant:** A single comment with a stable marker exists per PR.
   - **Proof Sketch:** The marker `<!-- openrouter-pr-review -->` is used as a unique identifier. If found, update; else create. This ensures at most one comment per PR.

## Failure Modes and Handling
- **Network failures:** `curl -sS` propagates non-zero exit on connection failure due to `set -euo pipefail`.
- **Missing secrets:** `OPENROUTER_API_KEY` missing leads to API failure and non-empty response validation prevents false success.
- **Missing labels:** The script creates labels before use, avoiding API errors.

## Mathematical Rigor Notes
- **Bounded Prompt Size:** The prompt size is bounded by the max diff size plus constant prompt size. If `P` is prompt length, then `P <= MAX + C` where `C` is the fixed prompt overhead and metadata. This ensures that prompt length does not exceed controllable limits.
- **Deterministic Verdict Parsing:** The regex is deterministic; it accepts exactly three tokens. This prevents label churn from ambiguous outputs, maintaining triage stability.
# Logic Map

## Overview
This document explains the logic chain for updating `UPDATES_STRATEGY.md` with standardized list formatting while preserving the intent of each section.

## Logic Chain (Steps 1–3)
1. **Identify the target scope**
   - The requested change focuses on list markers within `UPDATES_STRATEGY.md`.
   - Objective: normalize bullet spacing while preserving content meaning.
2. **Preserve semantic content**
   - Keep each section title and bullet text intact.
   - Ensure the meaning of each "Current State," "Upgrade," and "Benefit" statement remains unchanged.
3. **Apply precise formatting corrections**
   - Replace indented bullet markers (`*   `) with a consistent bullet marker (`* `).
   - Confirm that headings remain unchanged and list order is preserved.

## Verification Notes
- The change is localized to list marker spacing.
- No text content is altered beyond whitespace normalization.
- Section order and labels are preserved for traceability.

## Logic Chain: Linguistic Engine & Corpus Loading (Steps 1–3)
1. **Identify production-grade gaps**
   - **Why:** The phoneme pipeline contained placeholder comments, verb transitivity was mocked, and adverbs were injected as mock data.
   - **Invariant:** Every generation and parsing path must be driven by deterministic, data-backed logic rather than stub comments.
2. **Replace placeholders with deterministic linguistic mechanics**
   - **Why:** Grapheme segmentation, silent-e handling, and digraph recognition prevent re-processing errors and improve syllable/stress accuracy.
   - **Invariant:** Each grapheme token is processed exactly once in left-to-right order, ensuring no conflicting substitutions.
   - **Proof Sketch:** The tokenizer advances index `i` by 2 on digraph/vowel-team hits and by 1 otherwise. Therefore, each character participates in at most one token, yielding a total order without overlaps.
3. **Enforce grammatical constraints and corpus sourcing**
   - **Why:** Verb transitivity must guide whether direct objects appear; adverbs must originate from the lexicon; lyric corpus should load real files when available.
   - **Invariant:** Transitive verbs prefer `V NP`, intransitives avoid object insertion; adverbs are derived from `lexicon.Adv`; corpus loading resolves `/lyrics/*.txt` entries before falling back to embedded lines.
   - **Proof Sketch:** The VP generator branches on `feats.trans` with explicit paths, and `import.meta.glob` enumerates real assets, ensuring coverage without mock fillers.
