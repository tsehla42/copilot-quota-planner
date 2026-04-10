import { describe, it, expect } from 'vitest';
import { escHtml } from '../js/auth.js';

describe('escHtml', () => {
  it('escapes &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('escapes <', () => expect(escHtml('<tag>')).toBe('&lt;tag&gt;'));
  it('escapes >', () => expect(escHtml('a>b')).toBe('a&gt;b'));
  it('escapes "', () => expect(escHtml('"quote"')).toBe('&quot;quote&quot;'));
  it('passes through plain strings', () => expect(escHtml('hello world')).toBe('hello world'));
  it('converts non-strings to string', () => expect(escHtml(42)).toBe('42'));
});
