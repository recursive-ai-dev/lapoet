// Copyright 2025 Recursive AI Devs
// Universal Linguistic Engine for AG-TUNE
// Provides production-grade phonetics, morphology, and grammar generation logic.

/**
 * @typedef {{
 *  code: 'INVALID_INPUT' | 'INVALID_CONSTRAINT' | 'RNG_EXHAUSTED' | 'LEXICON_MISSING' | 'GENERATION_FAILED',
 *  message: string,
 *  details?: Record<string, unknown>
 * }} ChainError
 */

/**
 * @typedef {{
 *  correlation_id?: string,
 *  step_name: string,
 *  latency_ms: number,
 *  [key: string]: unknown
 * }} StructuredLog
 */

class LogicChainError extends Error {
  /**
   * @param {ChainError['code']} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LogicChainError';
    this.code = code;
    this.details = details;
  }
}

class DeterministicClock {
  constructor(nowMs = 0) {
    this.nowMs = nowMs;
  }

  now() {
    return this.nowMs;
  }
}

class CounterIdGenerator {
  constructor(prefix = 'corr') {
    this.prefix = prefix;
    this.counter = 0;
  }

  next() {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}

class NullLogger {
  /** @param {StructuredLog} _entry */
  info(_entry) {}

  /** @param {StructuredLog} _entry */
  error(_entry) {}
}

/**
 * Universal Linguistic Engine
 * A logic-driven system for phonetics, morphology, and syntax generation.
 */
export class UniversalLinguisticEngine {
  constructor({ rng, clock, idGenerator, logger } = {}) {
    this.rng = rng;
    this.clock = clock ?? new DeterministicClock(0);
    this.idGenerator = idGenerator ?? new CounterIdGenerator();
    this.logger = logger ?? new NullLogger();
    this.phonetics = new PhoneticEngine();
    this.grammar = new ConstraintGrammar(this.rng);
  }

  /**
   * Analyze a word for poetic features.
   * @param {string | {word: string, correlation_id?: string}} input
   */
  analyze(input) {
    const start = this.clock.now();
    const correlationId = this._getCorrelationId(input);

    const word = typeof input === 'string' ? input : input?.word;
    if (typeof word !== 'string' || word.trim().length === 0) {
      const err = new LogicChainError('INVALID_INPUT', 'analyze requires a non-empty word', { input });
      this._logError(correlationId, 'analyze.validate', start, err);
      throw err;
    }

    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length === 0) {
      const err = new LogicChainError('INVALID_INPUT', 'word must contain alphabetical characters', { word });
      this._logError(correlationId, 'analyze.clean', start, err);
      throw err;
    }

    const phonemes = this.phonetics.toPhonemes(cleanWord);
    const result = {
      word,
      phonemes,
      syllables: this.phonetics.countSyllablesFromPhonemes(phonemes),
      stressPattern: this.phonetics.estimateStress(phonemes),
      rhymePart: this.phonetics.getRhymePart(phonemes)
    };

    this._logInfo(correlationId, 'analyze.complete', start, { word: cleanWord, syllables: result.syllables });
    return result;
  }

  /**
   * Generate a sentence structure based on constraints.
   * @param {{ complexity?: number, constraints?: Record<string, string>, correlation_id?: string }} [input]
   */
  generateStructure(input = {}) {
    const start = this.clock.now();
    const correlationId = this._getCorrelationId(input);
    const complexity = Number.isFinite(input.complexity) ? Number(input.complexity) : 1;
    const constraints = input.constraints ?? {};

    if (complexity < 1 || complexity > 5) {
      const err = new LogicChainError('INVALID_INPUT', 'complexity must be between 1 and 5', { complexity });
      this._logError(correlationId, 'generateStructure.validate', start, err);
      throw err;
    }

    const sentence = this.grammar.generate('S', { ...constraints, complexity });
    this._logInfo(correlationId, 'generateStructure.complete', start, { complexity, sentence_length: sentence.length });
    return sentence;
  }

  /**
   * Get the grammar in a flat format for the CYK parser.
   * @param {{ correlation_id?: string }} [input]
   */
  getGrammar(input = {}) {
    const start = this.clock.now();
    const correlationId = this._getCorrelationId(input);
    const grammar = this.grammar.getFlatGrammar();
    this._logInfo(correlationId, 'getGrammar.complete', start, { non_terminals: Object.keys(grammar).length });
    return grammar;
  }

  _getCorrelationId(input) {
    if (input && typeof input === 'object' && input.correlation_id) {
      return String(input.correlation_id);
    }
    return this.idGenerator.next();
  }

  _logInfo(correlationId, stepName, startMs, fields = {}) {
    this.logger.info({
      correlation_id: correlationId,
      step_name: stepName,
      latency_ms: this.clock.now() - startMs,
      ...fields
    });
  }

  _logError(correlationId, stepName, startMs, error) {
    this.logger.error({
      correlation_id: correlationId,
      step_name: stepName,
      latency_ms: this.clock.now() - startMs,
      code: error.code,
      message: error.message,
      details: error.details
    });
  }
}

class PhoneticEngine {
  constructor() {
    this.rules = [
      { regex: /tion$/g, repl: 'S u n' },
      { regex: /sion$/g, repl: 'Z u n' },
      { regex: /ough$/g, repl: 'o' },
      { regex: /igh$/g, repl: 'Y' },
      { regex: /ight/g, repl: 'Y t' },
      { regex: /([aeiou])([^aeiou])e$/g, repl: '$1:$2' },
      { regex: /ee/g, repl: 'I' },
      { regex: /ea/g, repl: 'I' },
      { regex: /oo/g, repl: 'U' },
      { regex: /ou/g, repl: 'W' },
      { regex: /ow/g, repl: 'W' },
      { regex: /ai/g, repl: 'A' },
      { regex: /ay/g, repl: 'A' },
      { regex: /oa/g, repl: 'O' },
      { regex: /ie/g, repl: 'Y' },
      { regex: /ei/g, repl: 'A' },
      { regex: /oy/g, repl: 'O Y' },
      { regex: /oi/g, repl: 'O Y' },
      { regex: /au/g, repl: 'O' },
      { regex: /aw/g, repl: 'O' },
      { regex: /sh/g, repl: 'S' },
      { regex: /ch/g, repl: 'C' },
      { regex: /th/g, repl: 'T' },
      { regex: /ph/g, repl: 'F' },
      { regex: /ck/g, repl: 'k' },
      { regex: /wh/g, repl: 'w' },
      { regex: /wr/g, repl: 'r' },
      { regex: /kn/g, repl: 'n' },
      { regex: /gn/g, repl: 'n' },
      { regex: /ng/g, repl: 'G' },
      { regex: /y$/g, repl: 'E' },
      { regex: /a/g, repl: '@' },
      { regex: /e/g, repl: 'E' },
      { regex: /i/g, repl: 'i' },
      { regex: /o/g, repl: 'o' },
      { regex: /u/g, repl: 'u' },
      { regex: /:/g, repl: '' }
    ];
    this.shortVowels = {
      a: '@',
      e: 'E',
      i: 'i',
      o: 'o',
      u: 'u'
    };
  }

  toPhonemes(text) {
    let current = text.toLowerCase();
    current = current.replace(/^un/g, 'un ');
    current = current.replace(/^re/g, 're ');
    current = current.replace(/^in/g, 'in ');
    current = current.replace(/ing$/g, ' ing');
    current = current.replace(/ed$/g, ' ed');
    current = current.replace(/s$/g, ' s');
    current = current.replace(/ly$/g, ' l E');
    current = current.replace(/ment$/g, ' m E n t');

    const parts = current.split(' ');
    const phonemizedParts = parts.map((part) => {
      let p = part;
      if (/([aeiou])([^aeiou])e$/.test(p)) {
        p = p.replace(/([aeiou])([^aeiou])e$/, (match, v, c) => {
          let lv = v;
          if (v === 'a') lv = 'A';
          else if (v === 'e') lv = 'I';
          else if (v === 'i') lv = 'Y';
          else if (v === 'o') lv = 'O';
          else if (v === 'u') lv = 'U';
          return lv + c;
        });
      }

      for (const rule of this.rules) {
        rule.regex.lastIndex = 0;
        if (rule.regex.test(p)) {
          p = p.replace(rule.regex, rule.repl);
        }
      }

      return p.replace(/:/g, '');
    });

    return phonemizedParts.join('');
  }

  countSyllablesFromPhonemes(phonemes) {
    const vowels = phonemes.match(/[@EiouAIUWOY]+/g);
    return vowels ? vowels.length : 1;
  }

  estimateStress(phonemes) {
    const syllables = [];
    let currentSyllable = '';

    for (const char of phonemes) {
      if ('@EiouAIUWOY'.includes(char)) {
        currentSyllable += char;
        syllables.push(currentSyllable);
        currentSyllable = '';
      } else {
        currentSyllable += char;
      }
    }

    if (currentSyllable.length > 0 && syllables.length > 0) {
      syllables[syllables.length - 1] += currentSyllable;
    } else if (currentSyllable.length > 0) {
      syllables.push(currentSyllable);
    }

    return syllables.map((s) => (/[AIUWOY]/.test(s) ? 1 : 0));
  }

  getRhymePart(phonemes) {
    const matches = [...phonemes.matchAll(/[@EiouAIUWOY]/g)];
    if (matches.length === 0) return phonemes;

    const lastVowelIndex = matches[matches.length - 1].index;
    return phonemes.substring(lastVowelIndex);
  }
}

class ConstraintGrammar {
  constructor(rng) {
    this.rng = rng;
    this.lexicon = this._buildProductionLexicon();
  }

  _random() {
    if (this.rng && typeof this.rng.next === 'function') {
      return this.rng.next();
    }
    if (typeof this.rng === 'function') {
      return this.rng();
    }
    throw new LogicChainError('INVALID_INPUT', 'Deterministic rng is required for generation');
  }

  _buildProductionLexicon() {
    return {
      N: [
        { word: 'heart', feats: { num: 'sg' }, tags: ['concrete', 'body'] },
        { word: 'hearts', feats: { num: 'pl' }, tags: ['concrete', 'body'] },
        { word: 'soul', feats: { num: 'sg' }, tags: ['abstract'] },
        { word: 'souls', feats: { num: 'pl' }, tags: ['abstract'] },
        { word: 'night', feats: { num: 'sg' }, tags: ['time', 'dark'] },
        { word: 'nights', feats: { num: 'pl' }, tags: ['time', 'dark'] },
        { word: 'shadow', feats: { num: 'sg' }, tags: ['dark'] },
        { word: 'shadows', feats: { num: 'pl' }, tags: ['dark'] },
        { word: 'light', feats: { num: 'sg' }, tags: ['light'] },
        { word: 'lights', feats: { num: 'pl' }, tags: ['light'] },
        { word: 'star', feats: { num: 'sg' }, tags: ['light', 'celestial'] },
        { word: 'stars', feats: { num: 'pl' }, tags: ['light', 'celestial'] },
        { word: 'wind', feats: { num: 'sg' }, tags: ['nature'] },
        { word: 'winds', feats: { num: 'pl' }, tags: ['nature'] },
        { word: 'fire', feats: { num: 'sg' }, tags: ['nature', 'destructive'] },
        { word: 'fires', feats: { num: 'pl' }, tags: ['nature', 'destructive'] },
        { word: 'dream', feats: { num: 'sg' }, tags: ['abstract'] },
        { word: 'dreams', feats: { num: 'pl' }, tags: ['abstract'] },
        { word: 'voice', feats: { num: 'sg' }, tags: ['human'] },
        { word: 'voices', feats: { num: 'pl' }, tags: ['human'] },
        { word: 'silence', feats: { num: 'sg' }, tags: ['abstract'] },
        { word: 'time', feats: { num: 'sg' }, tags: ['abstract'] },
        { word: 'river', feats: { num: 'sg' }, tags: ['nature'] },
        { word: 'rivers', feats: { num: 'pl' }, tags: ['nature'] },
        { word: 'ocean', feats: { num: 'sg' }, tags: ['nature'] },
        { word: 'oceans', feats: { num: 'pl' }, tags: ['nature'] },
        { word: 'mountain', feats: { num: 'sg' }, tags: ['nature'] },
        { word: 'mountains', feats: { num: 'pl' }, tags: ['nature'] },
        { word: 'whisper', feats: { num: 'sg' }, tags: ['sound'] },
        { word: 'whispers', feats: { num: 'pl' }, tags: ['sound'] },
        { word: 'ghost', feats: { num: 'sg' }, tags: ['supernatural'] },
        { word: 'ghosts', feats: { num: 'pl' }, tags: ['supernatural'] }
      ],
      V: [
        { word: 'burns', feats: { num: 'sg', tense: 'pres', trans: 'intrans' } },
        { word: 'burn', feats: { num: 'pl', tense: 'pres', trans: 'intrans' } },
        { word: 'fades', feats: { num: 'sg', tense: 'pres', trans: 'intrans' } },
        { word: 'fade', feats: { num: 'pl', tense: 'pres', trans: 'intrans' } },
        { word: 'calls', feats: { num: 'sg', tense: 'pres', trans: 'trans' } },
        { word: 'call', feats: { num: 'pl', tense: 'pres', trans: 'trans' } },
        { word: 'seek', feats: { num: 'pl', tense: 'pres', trans: 'trans' } },
        { word: 'seeks', feats: { num: 'sg', tense: 'pres', trans: 'trans' } },
        { word: 'lost', feats: { tense: 'past', trans: 'intrans' } },
        { word: 'found', feats: { tense: 'past', trans: 'trans' } },
        { word: 'weep', feats: { num: 'pl', tense: 'pres', trans: 'intrans' } },
        { word: 'weeps', feats: { num: 'sg', tense: 'pres', trans: 'intrans' } },
        { word: 'sings', feats: { num: 'sg', tense: 'pres', trans: 'intrans' } },
        { word: 'sing', feats: { num: 'pl', tense: 'pres', trans: 'intrans' } },
        { word: 'flows', feats: { num: 'sg', tense: 'pres', trans: 'intrans' } },
        { word: 'flow', feats: { num: 'pl', tense: 'pres', trans: 'intrans' } },
        { word: 'breaks', feats: { num: 'sg', tense: 'pres', trans: 'trans' } },
        { word: 'break', feats: { num: 'pl', tense: 'pres', trans: 'trans' } },
        { word: 'holds', feats: { num: 'sg', tense: 'pres', trans: 'trans' } },
        { word: 'hold', feats: { num: 'pl', tense: 'pres', trans: 'trans' } },
        { word: 'remembers', feats: { num: 'sg', tense: 'pres', trans: 'trans' } },
        { word: 'remember', feats: { num: 'pl', tense: 'pres', trans: 'trans' } }
      ],
      Adj: [
        { word: 'dark' }, { word: 'bright' }, { word: 'cold' }, { word: 'eternal' },
        { word: 'soft' }, { word: 'silent' }, { word: 'broken' }, { word: 'ancient' },
        { word: 'hollow' }, { word: 'fading' }, { word: 'golden' }, { word: 'bitter' },
        { word: 'deep' }, { word: 'vast' }, { word: 'lost' }, { word: 'wild' },
        { word: 'still' }, { word: 'empty' }, { word: 'endless' }, { word: 'fragile' },
        { word: 'crystal' }, { word: 'silver' }, { word: 'crimson' }, { word: 'azure' }
      ],
      Adv: [
        { word: 'softly', feats: { manner: 'gentle' } },
        { word: 'gently', feats: { manner: 'gentle' } },
        { word: 'boldly', feats: { manner: 'strong' } },
        { word: 'slowly', feats: { manner: 'slow' } },
        { word: 'brightly', feats: { manner: 'radiant' } },
        { word: 'quietly', feats: { manner: 'subtle' } }
      ],
      Det: [
        { word: 'the', feats: {} },
        { word: 'a', feats: { num: 'sg' } },
        { word: 'my', feats: {} },
        { word: 'our', feats: {} },
        { word: 'this', feats: { num: 'sg' } },
        { word: 'those', feats: { num: 'pl' } },
        { word: 'some', feats: {} },
        { word: 'no', feats: {} }
      ],
      Prep: [
        { word: 'in' }, { word: 'on' }, { word: 'through' }, { word: 'beyond' },
        { word: 'beneath' }, { word: 'against' }, { word: 'with' }, { word: 'without' },
        { word: 'under' }, { word: 'over' }, { word: 'above' }, { word: 'below' },
        { word: 'into' }, { word: 'from' }, { word: 'to' }, { word: 'near' }
      ]
    };
  }

  _selectEntry(symbol, constraints = {}) {
    const entries = this.lexicon[symbol] ?? [];
    if (entries.length === 0) {
      throw new LogicChainError('LEXICON_MISSING', 'No lexicon entries found for symbol', { symbol });
    }

    const candidates = entries.filter((entry) => {
      for (const [key, val] of Object.entries(constraints)) {
        if (key === 'complexity') continue;
        if (entry.feats && entry.feats[key] && entry.feats[key] !== val) return false;
      }
      return true;
    });

    const pool = candidates.length > 0 ? candidates : entries;
    const idx = Math.floor(this._random() * pool.length);
    if (idx < 0 || idx >= pool.length) {
      throw new LogicChainError('RNG_EXHAUSTED', 'RNG produced an out-of-range index', { symbol, poolLength: pool.length, idx });
    }
    return pool[idx];
  }

  generate(symbol, constraints = {}) {
    if (this.lexicon[symbol]) {
      return this._selectEntry(symbol, constraints).word;
    }

    switch (symbol) {
      case 'S': {
        const num = this._random() > 0.5 ? 'sg' : 'pl';
        return `${this.generate('NP', { ...constraints, num })} ${this.generate('VP', { ...constraints, num })}`;
      }
      case 'NP': {
        const r = this._random();
        const localConstraints = { ...constraints };
        if (!localConstraints.num) {
          localConstraints.num = this._random() > 0.5 ? 'sg' : 'pl';
        }

        if (r < 0.35) {
          return `${this.generate('Det', localConstraints)} ${this.generate('N', localConstraints)}`;
        }
        if (r < 0.7) {
          return `${this.generate('Det', localConstraints)} ${this.generate('Adj')} ${this.generate('N', localConstraints)}`;
        }
        if (r < 0.85) {
          return `${this.generate('Det', localConstraints)} ${this.generate('Adj')} ${this.generate('Adj')} ${this.generate('N', localConstraints)}`;
        }

        if (localConstraints.num === 'sg') {
          return `${this.generate('Det', localConstraints)} ${this.generate('N', localConstraints)}`;
        }
        return this.generate('N', localConstraints);
      }
      case 'VP': {
        const verbEntry = this._selectEntry('V', constraints);
        const verb = verbEntry.word;
        const trans = verbEntry.feats?.trans || 'intrans';
        const prefix = this._random() < 0.25 ? `${this.generate('Adv')} ` : '';

        if (trans === 'intrans') {
          if (this._random() < 0.4) {
            return `${prefix}${verb} ${this.generate('PP')}`;
          }
          return `${prefix}${verb}`;
        }

        if (this._random() < 0.2) {
          return `${prefix}${verb} ${this.generate('NP')} ${this.generate('PP')}`;
        }
        return `${prefix}${verb} ${this.generate('NP')}`;
      }
      case 'PP':
        return `${this.generate('Prep')} ${this.generate('NP')}`;
      default:
        throw new LogicChainError('GENERATION_FAILED', 'Unsupported grammar symbol', { symbol });
    }
  }

  getFlatGrammar() {
    const grammar = {};
    const symbols = Object.keys(this.lexicon);

    symbols.forEach((sym) => {
      grammar[sym] = this.lexicon[sym].map((o) => o.word);
    });

    grammar.S = [['NP', 'VP'], ['VP'], ['S', 'PP']];
    grammar.NP = [['Det', 'N'], ['N'], ['Adj', 'N'], ['NP', 'PP'], ['Det', 'Adj', 'N']];
    grammar.VP = [['V', 'NP'], ['V'], ['Adv', 'VP'], ['VP', 'PP'], ['Adv', 'V'], ['V', 'PP']];
    grammar.PP = [['P', 'NP'], ['Prep', 'NP']];

    grammar.Det = this.lexicon.Det.map((o) => o.word);
    grammar.Adj = this.lexicon.Adj.map((o) => o.word);
    grammar.N = this.lexicon.N.map((o) => o.word);
    grammar.V = this.lexicon.V.map((o) => o.word);
    grammar.P = this.lexicon.Prep.map((o) => o.word);
    grammar.Prep = this.lexicon.Prep.map((o) => o.word);
    grammar.Adv = this.lexicon.Adv.map((o) => o.word);

    return grammar;
  }
}
