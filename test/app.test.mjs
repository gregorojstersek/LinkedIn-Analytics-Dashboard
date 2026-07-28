import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  state,
  getMetricValue,
  getPostEngagement,
  getEngagementRate,
  truncate,
  getDisplayText,
  isRepost,
  escapeHtml,
  withinRangePost,
  sortPosts,
  applyFilters,
  getKpis,
  buildTrendSeries
} from '../src/app.mjs';

test('getMetricValue returns the numeric value when present', () => {
  assert.equal(getMetricValue({ reactions: 5 }, 'reactions'), 5);
});

test('getMetricValue returns null for missing/negative/non-numeric values', () => {
  assert.equal(getMetricValue({}, 'reactions'), null);
  assert.equal(getMetricValue({ reactions: -1 }, 'reactions'), null);
  assert.equal(getMetricValue({ reactions: 'abc' }, 'reactions'), null);
});

test('getMetricValue treats 0 as "unavailable" for extension-only metrics the feed does not expose', () => {
  assert.equal(getMetricValue({ clicks: 0, source: 'chrome-extension' }, 'clicks'), null);
  assert.equal(getMetricValue({ saves: 0, source: 'chrome-extension' }, 'saves'), null);
  // A real 0 from a source that does report the metric is not hidden.
  assert.equal(getMetricValue({ clicks: 0, source: 'demo-data' }, 'clicks'), 0);
  // 0 is a real value for metrics that chrome-extension does report.
  assert.equal(getMetricValue({ reactions: 0, source: 'chrome-extension' }, 'reactions'), 0);
});

test('getPostEngagement sums known interaction metrics when no engagement total is given', () => {
  const engagement = getPostEngagement({ reactions: 3, comments: 2, reposts: 1, clicks: 0, saves: 0 });
  assert.equal(engagement, 6);
});

test('getPostEngagement prefers an explicit engagement field over the sum', () => {
  assert.equal(getPostEngagement({ engagement: 100, reactions: 3 }), 100);
});

test('getEngagementRate is 0 for posts with no impressions', () => {
  assert.equal(getEngagementRate({ impressions: 0, reactions: 5 }), 0);
});

test('getEngagementRate divides engagement by impressions', () => {
  assert.equal(getEngagementRate({ impressions: 200, reactions: 20 }), 0.1);
});

test('truncate leaves short text untouched and ellipsizes long text', () => {
  assert.equal(truncate('short text'), 'short text');
  const long = 'a'.repeat(100);
  const truncated = truncate(long, 10);
  assert.equal(truncated, `${'a'.repeat(9)}...`);
});

test('getDisplayText strips a leading author/time-bullet preamble', () => {
  // Shape LinkedIn's DOM scrape tends to produce: "<author> • <age> • <body>".
  const text = 'Jane Doe • 3d • Original insight about growth loops follows here';
  const display = getDisplayText({ text });
  assert.ok(!display.startsWith('Jane Doe'));
  assert.equal(display, 'Original insight about growth loops follows here');
});

test('getDisplayText falls back to "Untitled post" for empty text', () => {
  assert.equal(getDisplayText({ text: '' }), 'Untitled post');
});

test('isRepost prefers the explicit boolean flag over text sniffing', () => {
  assert.equal(isRepost({ isRepost: false, text: 'reposted this' }), false);
  assert.equal(isRepost({ text: 'reposted this great update' }), true);
  assert.equal(isRepost({ text: 'a normal original post' }), false);
});

test('escapeHtml neutralizes markup-significant characters', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('withinRangePost treats "all" as always in range', () => {
  assert.equal(withinRangePost({ createdAt: '2000-01-01' }, 'all'), true);
});

test('withinRangePost excludes posts older than the requested day range', () => {
  const old = { createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString() };
  const recent = { createdAt: new Date().toISOString() };
  assert.equal(withinRangePost(old, '90'), false);
  assert.equal(withinRangePost(recent, '90'), true);
});

test('withinRangePost excludes posts with no resolvable date', () => {
  assert.equal(withinRangePost({}, '90'), false);
});

test('sortPosts orders by impressions descending', () => {
  const posts = [{ id: 'a', impressions: 10 }, { id: 'b', impressions: 50 }, { id: 'c', impressions: 30 }];
  const sorted = sortPosts(posts, 'impressions');
  assert.deepEqual(sorted.map((p) => p.id), ['b', 'c', 'a']);
});

test('sortPosts orders by engagement descending', () => {
  const posts = [
    { id: 'a', reactions: 1 },
    { id: 'b', reactions: 10 },
    { id: 'c', reactions: 5 }
  ];
  const sorted = sortPosts(posts, 'engagement');
  assert.deepEqual(sorted.map((p) => p.id), ['b', 'c', 'a']);
});

test('sortPosts does not mutate the input array', () => {
  const posts = [{ id: 'a', impressions: 1 }, { id: 'b', impressions: 2 }];
  sortPosts(posts, 'impressions');
  assert.deepEqual(posts.map((p) => p.id), ['a', 'b']);
});

test('getKpis aggregates impressions/engagement across a post list', () => {
  const posts = [
    { impressions: 100, reactions: 5, comments: 1, reposts: 0 },
    { impressions: 200, reactions: 10, comments: 2, reposts: 1 }
  ];
  const kpis = getKpis(posts);
  assert.equal(kpis.totalPosts, 2);
  assert.equal(kpis.impressions, 300);
  assert.equal(kpis.reactions, 15);
  assert.ok(kpis.averageRate > 0);
});

test('getKpis handles an empty post list without dividing by zero', () => {
  const kpis = getKpis([]);
  assert.equal(kpis.totalPosts, 0);
  assert.equal(kpis.averageRate, 0);
});

test('buildTrendSeries groups posts by day and sums metrics, skipping undated posts', () => {
  const day = '2026-01-01T12:00:00.000Z';
  const posts = [
    { createdAt: day, impressions: 100, reactions: 5 },
    { createdAt: day, impressions: 50, reactions: 5 },
    {}
  ];
  const series = buildTrendSeries(posts);
  assert.equal(series.length, 1);
  assert.equal(series[0].date, '2026-01-01');
  assert.equal(series[0].impressions, 150);
});

test('applyFilters combines search, type, range, and minImpressions filters', () => {
  state.posts = [
    { id: '1', text: 'growth loops for B2B', contentType: 'text', impressions: 500, createdAt: new Date().toISOString() },
    { id: '2', text: 'career lessons learned', contentType: 'image', impressions: 50, createdAt: new Date().toISOString() },
    { id: '3', text: 'old growth post', contentType: 'text', impressions: 900, createdAt: '2000-01-01T00:00:00.000Z' }
  ];
  state.filters = { search: 'growth', range: '90', type: 'all', minImpressions: 100, sort: 'latest' };
  state.selectedId = null;

  applyFilters();

  assert.deepEqual(state.filtered.map((p) => p.id), ['1']);
});

test('applyFilters clears selectedId when the previously selected post is filtered out', () => {
  state.posts = [
    { id: '1', text: 'a', contentType: 'text', impressions: 10, createdAt: new Date().toISOString() },
    { id: '2', text: 'b', contentType: 'text', impressions: 10, createdAt: new Date().toISOString() }
  ];
  state.filters = { search: '', range: 'all', type: 'all', minImpressions: 0, sort: 'latest' };
  state.selectedId = '1';

  applyFilters();
  assert.equal(state.filtered.some((p) => p.id === '1'), true);

  state.filters.minImpressions = 1000;
  applyFilters();
  assert.equal(state.filtered.length, 0);
  assert.equal(state.selectedId, null);
});
