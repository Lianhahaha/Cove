import { describe, expect, it } from 'vitest';
import { aiBlockedReason, AI_INPUT_CHARS, preparePayload, redact } from './ai';
import { newItem } from './repo';

describe('redact', () => {
  it.each([
    ['email me at juan.dela.cruz@up.edu.ph', 'email me at [email]'],
    ['text 0917 123 4567 or +639171234567', 'text [phone] or [phone]'],
    ['call +1 (415) 555-0132', 'call [phone]'],
    ['my password: hunter2 ok', 'my password: [hidden] ok'],
    ['PIN = 4321', 'PIN = [hidden]'],
    ['key sk-abcdefghijklmnopqrstu123', 'key [secret]'],
    ['ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345', '[secret]'],
    ['card 4111 1111 1111 1111', 'card [number]'],
    ['token eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4', 'token [secret]'],
    ['id a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', 'id [secret]'],
  ])('%s', (input, expected) => {
    expect(redact(input).text).toBe(expected);
  });

  it('leaves ordinary study text alone', () => {
    const text = 'Ohm’s law: V = IR. Quiz on 10/02 covers chapters 3-5, pages 120-145.';
    expect(redact(text)).toEqual({ text, count: 0 });
  });

  it('counts what it hid', () => {
    expect(redact('a@b.co and c@d.co').count).toBe(2);
  });
});

describe('preparePayload', () => {
  it('redacts and trims to the server limit', () => {
    const p = preparePayload({ title: 'Mail prof@school.edu', text: 'x'.repeat(AI_INPUT_CHARS + 50) });
    expect(p.input.title).toBe('Mail [email]');
    expect(p.input.text).toHaveLength(AI_INPUT_CHARS);
    expect(p.truncated).toBe(true);
    expect(p.redactions).toBe(1);
    expect(p.input.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('aiBlockedReason', () => {
  it('blocks private items and excluded spaces', () => {
    expect(aiBlockedReason(newItem({ private: true }), null)).toMatch(/private/);
    const space = { id: 's', name: 'Diary', aiExcluded: true } as never;
    expect(aiBlockedReason(newItem(), space)).toMatch(/Diary/);
    expect(aiBlockedReason(newItem(), null)).toBeNull();
  });
});
