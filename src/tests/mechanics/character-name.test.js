import { describe, expect, it } from 'vitest';
import { prepareCharacterName } from '../../engine/mechanics/character';

describe('new-character name preparation', () => {
  it.each([
    ['empty', ''], ['whitespace', ' \n\t '], ['null', null], ['undefined', undefined],
    ['number', 17], ['object', {}], ['81 units', 'a'.repeat(81)], ['huge', 'a'.repeat(300000)],
    ['81 unicode units', '🌈'.repeat(40) + 'a'],
  ])('rejects %s', (_label, raw) => {
    expect(prepareCharacterName(raw)).toEqual({ ok: false, reason: 'invalid_name' });
  });
  it.each(['a', 'a'.repeat(80), '🌈'.repeat(40), 'Zoë 李', 'Fuck Yeah'])('retains admitted names and trims their edges', name => {
    expect(prepareCharacterName(` \n${name}\t `)).toEqual({ ok: true, name });
  });
});
