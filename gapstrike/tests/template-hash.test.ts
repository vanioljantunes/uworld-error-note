import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { TEMPLATE_DEFAULTS, TEMPLATE_PREV_HASHES } from '../src/lib/template-defaults';

describe('TEMPLATE_PREV_HASHES bookkeeping (TMPL-07)', () => {
  it('anki_flowchart prev hashes include c9d31786fcdb0678', () => {
    expect(TEMPLATE_PREV_HASHES['anki_flowchart']).toContain('c9d31786fcdb0678');
  });

  it('anki_flowchart prev hashes include a20e902ae4a053e2 (08-01 template hash)', () => {
    expect(TEMPLATE_PREV_HASHES['anki_flowchart']).toContain('a20e902ae4a053e2');
  });

  it('current anki_flowchart content hash differs from all prev hashes', () => {
    const tpl = TEMPLATE_DEFAULTS.find(t => t.slug === 'anki_flowchart');
    const hash = createHash('sha256').update(tpl!.content).digest('hex').slice(0, 16);
    expect(TEMPLATE_PREV_HASHES['anki_flowchart']).not.toContain(hash);
  });
});
