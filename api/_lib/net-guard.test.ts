import { describe, expect, it } from 'vitest';
import { assertFetchableUrl, BlockedUrlError, expandV6, isBlockedAddress } from './net-guard';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::a00:1',
    'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '2001:db8::1', 'not-an-ip',
    '::ffff:0:127.0.0.1', '::ffff:0:a9fe:a9fe', '64:ff9b:1::a00:1', 'fec0::1',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe('expandV6', () => {
  it('expands compressed forms', () => {
    expect(expandV6('2001:db8::1')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(expandV6('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x102, 0x304]);
  });
  it('rejects malformed input', () => {
    expect(expandV6('1::2::3')).toBeNull();
    expect(expandV6('12345::')).toBeNull();
  });
});

describe('assertFetchableUrl', () => {
  it('accepts normal public links', () => {
    expect(assertFetchableUrl('https://example.com/a?b=c').hostname).toBe('example.com');
  });
  it.each([
    'ftp://example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://user:pass@example.com',
    'http://example.com:8080',
    'http://localhost/',
    'http://printer.local/',
    'http://printer.local./',
    'http://metadata.google.internal./',
    'http://LOCALHOST./',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data',
    'not a url',
  ])('rejects %s', (u) => expect(() => assertFetchableUrl(u)).toThrow(BlockedUrlError));
});
