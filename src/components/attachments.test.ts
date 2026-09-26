import { describe, expect, it } from 'vitest';
import { isViewable } from './Attachments';

describe('isViewable', () => {
  it.each(['image/png', 'image/jpeg', 'application/pdf', 'text/plain', 'text/plain; charset=utf-8', 'video/mp4', 'audio/mpeg'])('opens %s', (t) =>
    expect(isViewable(t)).toBe(true),
  );
  it.each(['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/xml', 'application/javascript', '', 'application/octet-stream'])(
    'downloads %s instead of opening it',
    (t) => expect(isViewable(t)).toBe(false),
  );
});
