import { UniversalLinguisticEngine } from './src/UniversalLinguisticEngine.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name, testFn) {
  totalTests++;
  console.log(`\n[Test ${totalTests}] ${name}`);

  try {
    const result = testFn();
    if (result) {
      console.log(`✓ PASSED`);
      passedTests++;
    } else {
      console.log(`✗ FAILED`);
    }
    return result;
  } catch (error) {
    console.log(`✗ ERROR: ${error.message}`);
    return false;
  }
}

console.log('='.repeat(80));
console.log('UNIVERSAL LINGUISTIC ENGINE TESTS');
console.log('='.repeat(80));

const ule = new UniversalLinguisticEngine();

runTest('analyze with non-alphabetical word throws INVALID_INPUT', () => {
    try {
        ule.analyze('123!?');
        return false; // Should have thrown
    } catch (e) {
        return e.name === 'LogicChainError' && e.code === 'INVALID_INPUT' && e.message === 'word must contain alphabetical characters';
    }
});

console.log('='.repeat(80));
console.log(`Tests: ${totalTests}, Passed: ${passedTests}, Failed: ${totalTests - passedTests}`);
console.log('='.repeat(80));

if (passedTests !== totalTests) {
    process.exit(1);
}
