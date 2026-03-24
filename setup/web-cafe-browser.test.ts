import { describe, expect, it } from 'vitest';

import {
  isIgnoredWebCafePath,
  isLikelyWebCafeContentPath,
  shouldKeepWebCafeLinkCandidate,
} from '../.claude/skills/web-cafe/lib/browser.ts';

describe('Web.Cafe link filtering', () => {
  it('rejects nav and account routes', () => {
    expect(isIgnoredWebCafePath('/messages')).toBe(true);
    expect(isIgnoredWebCafePath('/myTopic')).toBe(true);
    expect(isIgnoredWebCafePath('/user/demo')).toBe(true);
    expect(isIgnoredWebCafePath('/topics')).toBe(true);
  });

  it('recognizes content detail routes', () => {
    expect(isLikelyWebCafeContentPath('/topic/abc123')).toBe(true);
    expect(isLikelyWebCafeContentPath('/tutorial/xyz789')).toBe(true);
    expect(isLikelyWebCafeContentPath('/messages')).toBe(false);
    expect(isLikelyWebCafeContentPath('/experiences')).toBe(false);
  });

  it('keeps detail pages and rejects noisy top nav links', () => {
    expect(
      shouldKeepWebCafeLinkCandidate({
        pathname: '/topic/abc123',
        title: '2个改动，adsense收入增长0.5-1倍',
      }),
    ).toBe(true);

    expect(
      shouldKeepWebCafeLinkCandidate({
        pathname: '/messages',
        title: '群聊',
      }),
    ).toBe(false);

    expect(
      shouldKeepWebCafeLinkCandidate({
        pathname: '/myTopic',
        title: '我的帖子',
      }),
    ).toBe(false);

    expect(
      shouldKeepWebCafeLinkCandidate({
        pathname: '/tutorials',
        search: '?status=column',
        title: '教程专栏',
      }),
    ).toBe(false);
  });
});
