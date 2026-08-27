export class CYKParser {
  constructor() {
    this.rules = new Map();
    this.terminals = new Set();
    this.nonterminals = new Set();
  }

  addRule(lhs, rhs) {
    if (!this.rules.has(lhs)) {
      this.rules.set(lhs, []);
    }
    this.rules.get(lhs).push(rhs);
    this.nonterminals.add(lhs);

    rhs.forEach(symbol => {
      if (symbol.length === 1 && symbol === symbol.toLowerCase()) {
        this.terminals.add(symbol);
      }
    });
  }

  _initTable(n) {
    return Array(n).fill().map(() =>
      Array(n).fill().map(() => new Set())
    );
  }

  _fillTerminals(table, tokens, n) {
    for (let i = 0; i < n; i++) {
      for (const [lhs, rhsList] of this.rules) {
        for (const rhs of rhsList) {
          if (rhs.length === 1 && rhs[0] === tokens[i]) {
            table[i][i].add(lhs);
          }
        }
      }
    }
  }

  _processProduction(table, i, j, k, lhs, rhs) {
    if (rhs.length === 2) {
      const [B, C] = rhs;
      if (table[i][k].has(B) && table[k + 1][j].has(C)) {
        table[i][j].add(lhs);
      }
    }
  }

  _processRules(table, i, j, k) {
    for (const [lhs, rhsList] of this.rules) {
      for (const rhs of rhsList) {
        this._processProduction(table, i, j, k, lhs, rhs);
      }
    }
  }

  _fillNonTerminals(table, n) {
    for (let length = 2; length <= n; length++) {
      for (let i = 0; i <= n - length; i++) {
        const j = i + length - 1;
        for (let k = i; k < j; k++) {
          this._processRules(table, i, j, k);
        }
      }
    }
  }

  parse(tokens) {
    const n = tokens.length;
    if (n === 0) return false;

    const table = this._initTable(n);
    this._fillTerminals(table, tokens, n);
    this._fillNonTerminals(table, n);

    return table[0][n - 1].has('S');
  }
}
