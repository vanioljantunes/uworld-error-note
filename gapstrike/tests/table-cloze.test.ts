import { describe, it, expect } from 'vitest';
import { parseTable, rebuildTable } from '../src/components/TableEditor';

const FIXTURE_HTML = `<b>Kidney Development</b><br><br><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:rgba(255,255,255,0.08)"><th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">Structure</th><th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">Origin</th></tr><tr><td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">Collecting ducts</td><td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">{{c1::Mesonephric duct}}</td></tr><tr><td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">Nephrons</td><td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)"><b>{{c2::Metanephric blastema::embryo}}</b></td></tr></table>`;

describe('parseTable cloze passthrough', () => {
  it('preserves plain cloze syntax {{c1::text}} in cell value', () => {
    const parsed = parseTable(FIXTURE_HTML);
    // Row 0: "Collecting ducts" | "{{c1::Mesonephric duct}}"
    expect(parsed.rows[0][1]).toBe('{{c1::Mesonephric duct}}');
  });

  it('preserves cloze with hint and inline HTML {{c2::term::hint}} in cell value', () => {
    const parsed = parseTable(FIXTURE_HTML);
    // Row 1: "Nephrons" | "<b>{{c2::Metanephric blastema::embryo}}</b>"
    expect(parsed.rows[1][1]).toBe('<b>{{c2::Metanephric blastema::embryo}}</b>');
  });

  it('returns plain text for normal cells without cloze (no regression)', () => {
    const parsed = parseTable(FIXTURE_HTML);
    expect(parsed.rows[0][0]).toBe('Collecting ducts');
    expect(parsed.rows[1][0]).toBe('Nephrons');
  });

  it('round-trips cloze syntax through rebuildTable', () => {
    const parsed = parseTable(FIXTURE_HTML);
    const rebuilt = rebuildTable(parsed);
    expect(rebuilt).toContain('{{c1::Mesonephric duct}}');
    expect(rebuilt).toContain('{{c2::Metanephric blastema::embryo}}');
  });
});
