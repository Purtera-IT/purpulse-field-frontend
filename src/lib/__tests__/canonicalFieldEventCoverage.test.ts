import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  CANONICAL_FIELD_EVENT_COVERAGE,
  ITERATION_14_REQUIRED_FAMILIES,
} from '@/lib/canonicalFieldEventCoverage';

/** Registry is documentation-only; this test guards against drift, not runtime behavior. */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

describe('canonicalFieldEventCoverage', () => {
  it('lists every Iteration 14 required family exactly once', () => {
    const keys = Object.keys(CANONICAL_FIELD_EVENT_COVERAGE).sort();
    const required = [...ITERATION_14_REQUIRED_FAMILIES].sort();
    expect(keys).toEqual(required);
  });

  it('each row references an existing emitter module on disk', () => {
    for (const family of ITERATION_14_REQUIRED_FAMILIES) {
      const row = CANONICAL_FIELD_EVENT_COVERAGE[family];
      const abs = join(repoRoot, row.emitterModule);
      expect(existsSync(abs), `${family}: ${row.emitterModule}`).toBe(true);
    }
  });

  it('each emitter module contains listed export names (string match)', () => {
    for (const family of ITERATION_14_REQUIRED_FAMILIES) {
      const row = CANONICAL_FIELD_EVENT_COVERAGE[family];
      const src = readFileSync(join(repoRoot, row.emitterModule), 'utf8');
      for (const ex of row.emitExports) {
        expect(src.includes(ex), `${family}: missing "${ex}" in ${row.emitterModule}`).toBe(true);
      }
    }
  });
});
