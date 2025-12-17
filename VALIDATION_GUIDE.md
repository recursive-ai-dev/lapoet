# AG-TUNE Validation Guide

## Quick Start

```bash
# Run all validation tests
npm run test-all

# Or run individually
npm run test-modules          # 15 module tests
npm run test-invariants       # 10 system invariants
npm run test-ablation         # 7 component causality tests
npm run test-interpretability # Reasoning trace validation
```

---

## When to Run Tests

### Before Committing Code

**Always run** when you've modified:
- Any class in `lapoet.jsx` or `src/App.jsx`
- Training logic in `train-lyrics.js`
- Core algorithms (KernelPCA, TDValueEstimator, FFTMeterAnalyzer, etc.)

**Minimum requirement:** `npm run test-modules`

### Before Pull Requests

**Required:** `npm run test-all`

All tests must pass with 100% success rate.

### When Refactoring

**Critical:** Run tests before AND after refactoring.

If any test fails after refactoring:
1. The refactoring broke a behavioral invariant
2. Revert changes and investigate
3. Fix the issue maintaining the invariant
4. Re-run tests until all pass

---

## Understanding Test Results

### Module Validation Results

```
Tests Passed: 15/15
Success Rate: 100.0%

✅ ALL MODULE INVARIANTS SATISFIED
```

**What this means:**
- All components behave correctly in isolation
- Kernel PCA, FFT, CYK, TD(λ), etc. maintain their guarantees
- No regression in component behavior

**If tests fail:**
- Identify which module failed
- Check the specific invariant violated
- Review recent changes to that component
- Ensure the component still satisfies its contract

### System Invariants Results

```
Tests Passed: 10/10
Success Rate: 100.0%

✅ ALL SYSTEM INVARIANTS SATISFIED
```

**What this means:**
- End-to-end guarantees are maintained
- No ungrammatical output
- Cycle detection working
- Emotional continuity preserved
- All system-level properties hold

**If tests fail:**
- Check which invariant was violated
- Investigate component interactions
- Verify checkpoint integrity (if applicable)
- Ensure no component bypass occurred

### Ablation Study Results

```
✅ ALL COMPONENTS ARE CAUSAL
```

**What this means:**
- Every component serves a necessary function
- No component can be removed without degradation
- The multi-algorithm coalition is intact

**If causality is not proven:**
- A component may have become redundant
- Or the test methodology needs adjustment
- Investigate if architectural changes broke causality

### Interpretability Results

```
✅ INTERPRETABILITY VALIDATED
```

**What this means:**
- Reasoning traces can be extracted
- Every decision is explainable
- "You can watch it think" claim holds

---

## Interpreting Specific Test Failures

### Kernel PCA Tests

**"Reconstruction sanity" fails:**
- Kernel PCA transform/inverse is broken
- Check eigendecomposition implementation
- Verify polynomial kernel computation

**"Trajectory smoothness" fails:**
- Emotional embeddings are too random
- May indicate training data issues
- Or kernel degree parameter problem

**"Kernel sensitivity" fails:**
- Different kernel degrees not producing different results
- Polynomial kernel may be broken
- Check degree parameter is being used

**"Contrastive probes" fails:**
- Opposing emotions not divergent enough
- May indicate embedding space is degenerate
- Check training data quality

### FFT Tests

**"Known metrical patterns" fails:**
- FFT not consistently analyzing patterns
- Check DFT implementation
- Verify stress pattern extraction

**"Pattern discrimination" fails:**
- FFT cannot distinguish rhythmic from flat
- Check frequency analysis logic
- Verify dominant frequency detection

### CYK Tests

**"Fuzz testing" fails:**
- Random sequences being accepted
- Grammar rules too permissive
- Or CYK implementation broken

**"Mutation testing" fails:**
- Removing rules doesn't cause failures
- Grammar may be too flexible
- Or test methodology needs adjustment

### Cycle Detection Tests

**"Determinism" fails:**
- Same input producing different outputs
- Floyd algorithm has randomness
- Or state management issue

**"False positives" fails:**
- Detecting cycles where none exist
- Lookback window too small
- Or comparison logic broken

**"True positives" fails:**
- Missing actual cycles
- Lookback window too large
- Or Floyd algorithm broken

### TD(λ) Tests

**"Learning curve" fails:**
- Variance not decreasing
- Learning rate may be wrong
- Or eligibility traces broken

**"Reward ablation" fails:**
- Learning without rewards
- TD error calculation broken
- Or weight update logic wrong

**"Eligibility trace" fails:**
- Different λ not producing different behavior
- Trace decay not working
- Or gamma parameter issue

---

## Debugging Test Failures

### Step 1: Identify the Failure

Look at the test output to find which specific test failed.

Example:
```
✗ Trajectory smoothness: Consecutive emotional distance < random shuffle
  Consecutive distance: 0.0850
  Random distance: 0.0680
```

### Step 2: Understand the Invariant

Read the test description and understand what property it's checking.

For trajectory smoothness:
- Consecutive emotional vectors should be closer than random pairs
- This ensures smooth emotional arcs
- If failing, emotional space may be poorly structured

### Step 3: Check Recent Changes

```bash
git log --oneline -10
git diff HEAD~1 <file>
```

Look for changes to:
- The failing component
- Its dependencies
- Training or initialization logic

### Step 4: Add Debug Logging

Temporarily add logging to understand what's happening:

```javascript
console.log('Consecutive distances:', consecutiveDistances);
console.log('Random distances:', randomDistances);
```

### Step 5: Run Isolated Test

Instead of running all tests, focus on the failing one:

```bash
node test-module-validation.js | grep -A 10 "Trajectory smoothness"
```

### Step 6: Fix and Verify

1. Fix the issue
2. Re-run the specific test
3. Re-run all tests to ensure no new failures
4. Commit with test results in commit message

---

## Adding New Tests

### When to Add Tests

Add tests when:
- Adding a new component
- Adding a new feature with guarantees
- Finding a bug that wasn't caught
- Implementing an enhancement

### Test Template

```javascript
runTest('New test name: what it checks', () => {
  // Setup
  const component = new Component();
  
  // Execute
  const result = component.method();
  
  // Verify invariant
  const invariantHolds = result > expectedThreshold;
  
  // Log results
  console.log(`  Metric: ${result.toFixed(4)}`);
  
  // Return pass/fail
  return invariantHolds;
});
```

### Test Guidelines

1. **Test behavior, not implementation**
   - Focus on what the component guarantees
   - Not how it achieves it

2. **Use behavioral invariants**
   - Properties that must always hold
   - Not accuracy thresholds

3. **Make tests deterministic**
   - Same input → same output
   - Avoid randomness in tests themselves

4. **Log useful information**
   - Show actual vs expected values
   - Help debug when tests fail

5. **Keep tests fast**
   - Full suite should run in < 1 minute
   - Use representative samples

---

## Continuous Integration

### Adding to CI Pipeline

```yaml
- name: Run Validation Tests
  run: npm run test-all
  
- name: Check Test Results
  run: |
    if [ $? -ne 0 ]; then
      echo "Validation tests failed"
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running AG-TUNE validation tests..."
npm run test-modules

if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

---

## FAQ

**Q: Can I skip tests if I only changed documentation?**
A: Yes, documentation-only changes don't require validation tests.

**Q: What if test-invariants fails because checkpoint is missing?**
A: Run `npm run train` first to generate the checkpoint.

**Q: How long should the full test suite take?**
A: Approximately 30-60 seconds for all tests.

**Q: Can tests be parallelized?**
A: Yes, but currently they run sequentially. Parallelization could be added.

**Q: What if a test is flaky (passes sometimes, fails sometimes)?**
A: The test needs to be fixed. All tests should be 100% deterministic.

**Q: Can I modify test thresholds to make tests pass?**
A: Thresholds should not be arbitrarily changed to make failing tests pass. However, they may need adjustment if: (1) the underlying system behavior legitimately changes in a way that maintains correctness, or (2) initial thresholds were set incorrectly. Any threshold changes must be justified with clear reasoning about why the new threshold still validates the intended behavioral invariant.

**Q: How do I know which test file to run for a specific component?**
A: 
- Component behavior: `test-module-validation.js`
- System integration: `test-system-invariants.js`
- Component necessity: `test-ablation-study.js`
- Reasoning traces: `test-interpretability.js`

---

## Summary Checklist

Before committing:
- [ ] Run `npm run test-modules`
- [ ] All tests pass
- [ ] No new warnings
- [ ] Understand any failures

Before PR:
- [ ] Run `npm run test-all`
- [ ] 100% test success rate
- [ ] No behavioral regressions
- [ ] Test results documented in PR

After merging:
- [ ] CI passes
- [ ] No integration issues
- [ ] Validation framework still works

---

**Remember:** These tests prove AG-TUNE is not a black box. Every component is causal, every decision is explainable, and every guarantee can be verified. Maintain this transparency!
