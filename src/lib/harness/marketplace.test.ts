import { describe, expect, it } from 'vitest';
import { FEATURED_PLUGINS, installSpec } from './marketplace';
import { guessTitle } from '../id';

describe('marketplace', () => {
  it('builds github install spec', () => {
    expect(installSpec(FEATURED_PLUGINS[1])).toBe('github:ouyangyipeng/dsh-marketplace');
  });

  it('has featured dsh-plugin entries', () => {
    expect(FEATURED_PLUGINS.length).toBeGreaterThan(3);
  });
});

describe('titles', () => {
  it('truncates long first messages', () => {
    expect(guessTitle('abcdefghijklmnopqrstuvwxyz')).toMatch(/…$/);
  });
});
