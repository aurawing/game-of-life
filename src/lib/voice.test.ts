import { describe, expect, it } from 'vitest';
import { voiceErrorMessage } from './voice';

describe('voiceErrorMessage', () => {
  it('translates not-allowed to a Chinese permission hint', () => {
    expect(voiceErrorMessage('not-allowed')).toContain('麦克风权限');
    expect(voiceErrorMessage('not allowed')).toContain('麦克风权限');
    expect(voiceErrorMessage('NotAllowedError')).toContain('麦克风');
  });
});
