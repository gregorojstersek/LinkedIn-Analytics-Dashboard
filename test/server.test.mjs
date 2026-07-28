import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'li-dashboard-test-'));
process.env.DATA_FILE = path.join(tmpDir, 'posts.json');

const {
  server,
  normalizePost,
  mergePosts,
  sanitizeContentType,
  decodeLinkedInActivityTimestamp,
  toFiniteNumber,
  toOptionalFiniteNumber,
  maxKnownValue
} = await import('../server.mjs');

let baseUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmpDir, { recursive: true, force: true });
});

test('toFiniteNumber clamps negatives and non-numbers to 0', () => {
  assert.equal(toFiniteNumber(42), 42);
  assert.equal(toFiniteNumber(-5), 0);
  assert.equal(toFiniteNumber('abc'), 0);
  assert.equal(toFiniteNumber(undefined), 0);
});

test('toOptionalFiniteNumber preserves "unknown" as null', () => {
  assert.equal(toOptionalFiniteNumber(null), null);
  assert.equal(toOptionalFiniteNumber(''), null);
  assert.equal(toOptionalFiniteNumber(-1), null);
  assert.equal(toOptionalFiniteNumber('12'), 12);
});

test('maxKnownValue treats null as "unknown", not zero', () => {
  assert.equal(maxKnownValue(null, null), null);
  assert.equal(maxKnownValue(null, 5), 5);
  assert.equal(maxKnownValue(3, null), 3);
  assert.equal(maxKnownValue(3, 7), 7);
});

test('sanitizeContentType falls back to text for unknown values', () => {
  assert.equal(sanitizeContentType('image'), 'image');
  assert.equal(sanitizeContentType('IMAGE'), 'image');
  assert.equal(sanitizeContentType('bogus'), 'text');
  assert.equal(sanitizeContentType(undefined), 'text');
});

test('decodeLinkedInActivityTimestamp extracts a plausible date from a LinkedIn activity URN', () => {
  // Real-shaped activity id (encodes a timestamp in its high bits).
  const urn = 'urn:li:activity:7150000000000000000';
  const ms = decodeLinkedInActivityTimestamp(urn);
  assert.ok(ms > Date.parse('2010-01-01'));
  assert.ok(ms < Date.now() + 2 * 24 * 60 * 60 * 1000);
});

test('decodeLinkedInActivityTimestamp rejects input with no id-shaped number', () => {
  assert.equal(decodeLinkedInActivityTimestamp('not a urn'), null);
  assert.equal(decodeLinkedInActivityTimestamp(''), null);
});

test('normalizePost fills defaults for a minimal post', () => {
  const post = normalizePost({ text: 'Hello world' }, 0);
  assert.equal(post.text, 'Hello world');
  assert.equal(post.authorName, 'Me');
  assert.equal(post.contentType, 'text');
  assert.equal(post.impressions, 0);
  assert.equal(post.reactions, null);
  assert.ok(post.id.startsWith('li_'));
  assert.ok(post.postUrl.startsWith('https://www.linkedin.com/'));
});

test('normalizePost maps aliased metric fields (likes/views/etc.)', () => {
  const post = normalizePost({
    text: 'Aliases',
    views: 100,
    likes: 10,
    commentCount: 3,
    shares: 2
  });
  assert.equal(post.impressions, 100);
  assert.equal(post.reactions, 10);
  assert.equal(post.comments, 3);
  assert.equal(post.reposts, 2);
});

test('normalizePost detects reposts from text when isRepost is not set', () => {
  const post = normalizePost({ text: 'Jane Doe reposted this: great insight' });
  assert.equal(post.isRepost, true);
});

test('normalizePost is deterministic: same input yields the same id', () => {
  const input = { id: 'abc123', text: 'Same post' };
  const a = normalizePost(input);
  const b = normalizePost(input);
  assert.equal(a.id, b.id);
});

test('mergePosts keeps the earliest known createdAt and the longer text', () => {
  const oldPost = normalizePost({ id: '1', text: 'Short', createdAt: '2024-01-01T00:00:00.000Z' });
  const newPost = normalizePost({ id: '1', text: 'Short but longer version', createdAt: '2024-06-01T00:00:00.000Z' });

  const merged = mergePosts(oldPost, newPost);
  assert.equal(merged.createdAt, oldPost.createdAt);
  assert.equal(merged.text, 'Short but longer version');
});

test('mergePosts takes the max of known metrics and preserves null when both unknown', () => {
  const oldPost = normalizePost({ id: '1', text: 'a', reactions: 5 });
  const newPost = normalizePost({ id: '1', text: 'a', reactions: 9 });
  const merged = mergePosts(oldPost, newPost);
  assert.equal(merged.reactions, 9);

  const oldNoClicks = normalizePost({ id: '2', text: 'b' });
  const newNoClicks = normalizePost({ id: '2', text: 'b' });
  const mergedNoClicks = mergePosts(oldNoClicks, newNoClicks);
  assert.equal(mergedNoClicks.clicks, null);
});

test('GET /api/health responds ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('GET /api/posts starts empty', async () => {
  const res = await fetch(`${baseUrl}/api/posts`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.posts, []);
});

test('POST /api/posts/ingest rejects an empty payload', async () => {
  const res = await fetch(`${baseUrl}/api/posts/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts: [] })
  });
  assert.equal(res.status, 400);
});

test('POST /api/posts/ingest rejects invalid JSON', async () => {
  const res = await fetch(`${baseUrl}/api/posts/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json'
  });
  assert.equal(res.status, 400);
});

test('POST /api/posts/ingest stores new posts and GET /api/posts reflects them', async () => {
  const ingestRes = await fetch(`${baseUrl}/api/posts/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      posts: [{ id: 'post-1', text: 'My first post', impressions: 100 }]
    })
  });
  assert.equal(ingestRes.status, 200);
  const ingestBody = await ingestRes.json();
  assert.equal(ingestBody.ingested, 1);

  const getRes = await fetch(`${baseUrl}/api/posts`);
  const getBody = await getRes.json();
  assert.equal(getBody.posts.length, 1);
  assert.equal(getBody.posts[0].text, 'My first post');
});

test('POST /api/posts/ingest merges a re-sent post instead of duplicating it', async () => {
  await fetch(`${baseUrl}/api/posts`, { method: 'DELETE' });

  // Dedup keys off postUrl first, falling back to id only when postUrl is absent.
  // A real captured post always carries its LinkedIn postUrl, so supply one here.
  const postUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:1111111111/';

  await fetch(`${baseUrl}/api/posts/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts: [{ id: 'dup-1', postUrl, text: 'Version one', impressions: 10 }] })
  });
  await fetch(`${baseUrl}/api/posts/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts: [{ id: 'dup-1', postUrl, text: 'Version one, now longer', impressions: 50 }] })
  });

  const res = await fetch(`${baseUrl}/api/posts`);
  const body = await res.json();
  assert.equal(body.posts.length, 1);
  assert.equal(body.posts[0].impressions, 50);
  assert.equal(body.posts[0].text, 'Version one, now longer');
});

test('DELETE /api/posts clears all stored posts', async () => {
  await fetch(`${baseUrl}/api/posts/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts: [{ id: 'to-delete', text: 'gone soon' }] })
  });

  const deleteRes = await fetch(`${baseUrl}/api/posts`, { method: 'DELETE' });
  assert.equal(deleteRes.status, 200);

  const getRes = await fetch(`${baseUrl}/api/posts`);
  const body = await getRes.json();
  assert.deepEqual(body.posts, []);
});

test('GET request with plain ../ segments cannot escape the root (URL parser collapses them)', async () => {
  const res = await fetch(`${baseUrl}/../../etc/passwd`);
  // The WHATWG URL parser itself removes ".." dot-segments, so this never reaches
  // resolveStaticPath as a traversal attempt -- it just 404s as a missing file.
  assert.equal(res.status, 404);
});

test('GET request with %2f-encoded traversal segments is forbidden', async () => {
  // %2f keeps the slash encoded so the URL parser treats "..%2f..%2f" as one opaque
  // segment (not dot-segments to collapse); decodeURIComponent() only unescapes it
  // to "../../ " afterwards, inside resolveStaticPath, where the root-confinement check catches it.
  const res = await fetch(`${baseUrl}/..%2f..%2fetc/passwd`);
  assert.equal(res.status, 403);
});
