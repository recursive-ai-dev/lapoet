#!/usr/bin/env node
// Demo script showing improved English comprehension with pre-training
// Compares vocabulary coverage between pre-trained and legacy models

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the pre-trained checkpoint
const checkpointPath = path.join(__dirname, 'agtune-lyrics-checkpoint.json');

if (!fs.existsSync(checkpointPath)) {
  console.error('Error: Checkpoint not found. Please run "npm run train" first.');
  process.exit(1);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
// Checkpoint vocabulary is stored as array of [word, frequency] pairs
const vocabulary = new Map(checkpoint.vocabulary);
const vocabWords = new Set(checkpoint.vocabulary.map(([word, _]) => word));

console.log('='.repeat(70));
console.log('AG-TUNE PRE-TRAINED MODEL DEMONSTRATION');
console.log('='.repeat(70));
console.log();

// Display basic stats
console.log('📊 MODEL STATISTICS');
console.log('-'.repeat(70));
console.log(`Total Vocabulary Size: ${vocabulary.size} unique words`);
console.log(`Emotional Space Vectors: ${checkpoint.emotionalSpace.length}`);
console.log(`Training Timestamp: ${checkpoint.timestamp}`);
console.log(`Model Status: ${checkpoint.isTrained ? '✓ Fully Trained' : '✗ Not Trained'}`);
console.log();

// Test common English words (should be present with pre-training)
console.log('🔤 ENGLISH LANGUAGE COMPREHENSION TEST');
console.log('-'.repeat(70));

const commonEnglishWords = [
  // Articles
  'the', 'a', 'an',
  // Common verbs
  'is', 'are', 'was', 'have', 'do', 'walk', 'speak', 'think',
  // Common nouns
  'people', 'time', 'day', 'night', 'water', 'sun', 'moon',
  // Prepositions
  'in', 'on', 'at', 'with', 'through', 'above', 'below',
  // Conjunctions
  'and', 'but', 'or', 'because', 'when', 'while',
  // Adjectives
  'good', 'new', 'old', 'big', 'small', 'happy', 'sad'
];

let foundCount = 0;
const found = [];
const missing = [];

commonEnglishWords.forEach(word => {
  if (vocabWords.has(word)) {
    foundCount++;
    found.push(word);
  } else {
    missing.push(word);
  }
});

console.log(`Found: ${foundCount}/${commonEnglishWords.length} common English words`);
console.log(`Coverage: ${((foundCount / commonEnglishWords.length) * 100).toFixed(1)}%`);
console.log();

if (found.length > 0) {
  console.log('✓ Words found in vocabulary:');
  console.log('  ' + found.join(', '));
  console.log();
}

if (missing.length > 0) {
  console.log('✗ Words missing from vocabulary:');
  console.log('  ' + missing.join(', '));
  console.log();
}

// Test lyric-specific words
console.log('🎵 LYRIC-SPECIFIC VOCABULARY TEST');
console.log('-'.repeat(70));

const lyricWords = [
  'ghost', 'shadow', 'death', 'soul', 'dream', 'night', 'dark',
  'pain', 'sorrow', 'lonely', 'fear', 'tears', 'silence'
];

let lyricFoundCount = 0;
const lyricFound = [];
const lyricMissing = [];

lyricWords.forEach(word => {
  if (vocabWords.has(word)) {
    lyricFoundCount++;
    lyricFound.push(word);
  } else {
    lyricMissing.push(word);
  }
});

console.log(`Found: ${lyricFoundCount}/${lyricWords.length} lyric-specific words`);
console.log(`Coverage: ${((lyricFoundCount / lyricWords.length) * 100).toFixed(1)}%`);
console.log();

if (lyricFound.length > 0) {
  console.log('✓ Words found in vocabulary:');
  console.log('  ' + lyricFound.join(', '));
  console.log();
}

if (lyricMissing.length > 0) {
  console.log('✗ Words missing from vocabulary:');
  console.log('  ' + lyricMissing.join(', '));
  console.log();
}

// Sample vocabulary by frequency
console.log('📖 TOP 50 MOST FREQUENT WORDS');
console.log('-'.repeat(70));

// Sort by frequency (vocabulary is already [word, freq] pairs)
const sortedVocab = checkpoint.vocabulary
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50);

console.log(sortedVocab.map(([word, _]) => word).join(', '));
console.log();

// Categorize vocabulary
console.log('📂 VOCABULARY COMPOSITION ANALYSIS');
console.log('-'.repeat(70));

let englishCommonCount = 0;
let lyricSpecificCount = 0;
let sharedCount = 0;

// Simple heuristic: words from common English list are "English common"
const englishSet = new Set(commonEnglishWords);
const lyricSet = new Set(lyricWords);

vocabWords.forEach(word => {
  const inEnglish = englishSet.has(word);
  const inLyric = lyricSet.has(word);
  
  if (inEnglish && inLyric) {
    sharedCount++;
  } else if (inEnglish) {
    englishCommonCount++;
  } else if (inLyric) {
    lyricSpecificCount++;
  }
});

console.log(`English Common Words: ${englishCommonCount} (from test set)`);
console.log(`Lyric-Specific Words: ${lyricSpecificCount} (from test set)`);
console.log(`Shared Words: ${sharedCount} (in both sets)`);
console.log(`Other Words: ${vocabWords.size - englishCommonCount - lyricSpecificCount - sharedCount}`);
console.log();

// Final assessment
console.log('='.repeat(70));
console.log('ASSESSMENT');
console.log('='.repeat(70));

if (foundCount >= commonEnglishWords.length * 0.7) {
  console.log('✅ EXCELLENT: Strong English language comprehension detected!');
  console.log('   The model has been successfully pre-trained on English data.');
} else if (foundCount >= commonEnglishWords.length * 0.4) {
  console.log('⚠️  MODERATE: Partial English language comprehension.');
  console.log('   Consider adding more pre-training data.');
} else {
  console.log('❌ LIMITED: Minimal English language comprehension.');
  console.log('   Pre-training may not have been applied correctly.');
}

if (lyricFoundCount >= lyricWords.length * 0.7) {
  console.log('✅ EXCELLENT: Strong lyric-specific vocabulary!');
  console.log('   The model has been successfully fine-tuned on lyrics.');
} else {
  console.log('⚠️  WARNING: Limited lyric-specific vocabulary.');
  console.log('   The model may need more lyrics training.');
}

console.log();
console.log('The pre-trained model combines English comprehension with poetic expression! 🎯✨');
console.log('='.repeat(70));
