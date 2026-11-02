import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://frontend-dev:3000';

test('public pages render template names and category filtering from Java', async () => {
  const all = await fetch(base);
  assert.equal(all.status, 200);
  assert.match(await all.text(), /<h3[^>]*>山野明信片<\/h3>/);
  const design = await fetch(`${base}/?category=design`);
  const html = await design.text();
  assert.match(html, /<h3[^>]*>三格灵感板<\/h3>/);
  assert.doesNotMatch(html, /<h3[^>]*>山野明信片<\/h3>/);
});
