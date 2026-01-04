# TESTING

## Scope
These tests validate the PR review workflow logic without using mock data. The intent is to exercise every potential outcome of the verdict parser and the diff truncation logic.

## Test Matrix (Verdict Outcomes)
Test each of the following `Approve?` values and verify label behavior:
- **-1:** Empty review content (should fail workflow before labeling).
- **0:** `Approve?` not present (labels unchanged, no error).
- **1:** `Approve? APPROVE` (adds `ai:approve`, removes `ai:request-changes`).
- **2:** `Approve? REQUEST_CHANGES` (adds `ai:request-changes`, removes `ai:approve`).
- **3:** `Approve? COMMENT_ONLY` (adds `ai:comment-only`).
- **4:** Lowercase variants (e.g., `approve`, `request_changes`) should still parse.
- **5:** Bolded variants (e.g., `Approve? **APPROVE**`) should parse.
- **6:** Multiple occurrences (first match should be used).
- **7:** Unknown token (e.g., `Approve? MAYBE`) should lead to no labels.
- **8:** Very large review body with valid verdict should still label.
- **9:** Valid verdict with missing labels should auto-create labels.
- **10:** Valid verdict when labels already exist should reuse labels.
- **11:** Valid verdict with no permissions to create labels should fail at label creation (expected failure mode).
- **12:** Valid verdict with permission but no issue write should fail at label add (expected failure mode).

## Diff Truncation Tests
1. **Diff size < MAX (150000 bytes):** `Diff truncated: false` appears in prompt.
2. **Diff size == MAX:** `Diff truncated: false` appears in prompt.
3. **Diff size > MAX:** `Diff truncated: true` appears in prompt and diff file is exactly MAX bytes.

## Realistic Execution Steps (No Mock Data)
1. Create a PR with a small diff to confirm `Diff truncated: false`.
2. Create a PR with a large diff (>150KB) to confirm trimming and `Diff truncated: true`.
3. Ensure the review comment is updated rather than duplicated on subsequent pushes.
4. Confirm that labels are created on first run and updated on verdict changes.

## Verification Commands (Local)
These are structural checks, not mocks:
- `yamllint .github/workflows/openrouter-pr-review.yml`
- `rg -n "openrouter-pr-review" .github/workflows/openrouter-pr-review.yml`

## Expected Artifacts
- `review.md` populated with the model response.
- Single PR comment with marker `<!-- openrouter-pr-review -->`.
- Labels applied according to verdict.
