import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteCSV } from './csv.js';

test('quoteCSV escapes quotes and wraps text', () => {
  assert.strictEqual(quoteCSV('a"b'), '"a""b"');
  assert.strictEqual(quoteCSV('simple'), '"simple"');
});
