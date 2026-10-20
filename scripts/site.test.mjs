import test from 'node:test';
import assert from 'node:assert/strict';
import { publicReport, issuePage, sourceUrl, feedXml } from './site.mjs';

function sample() {
  return { status: 'complete', date: '2026-10-20', generatedAt: '2026-10-20T04:48:00Z', window: { start: '2026-10-19T04:00:00Z', end: '2026-10-20T04:00:00Z' }, privateSentinel: 'DO_NOT_PUBLISH_INTERNAL_RECORDS', modelLabel: 'PRIVATE_MODEL_ROUTE', candidates: [{ id: 'x:123', author: '@example', platform: 'X', publishedAt: '2026-10-19T12:00:00Z', url: 'https://x.com/i/status/123', text: 'DO_NOT_PUBLISH_FULL_ORIGINAL', _media: ['DO_NOT_PUBLISH_MEDIA_URL'], evidence: { label: '仅原帖，未核验视频', text: 'DO_NOT_PUBLISH_RAW_TRANSCRIPT' } }], digest: { takeaways: ['需要核对原始来源。'], items: [{ title: '模型发布', category: '模型与研究', summary: '公开编辑摘要。', whyItMatters: '技术变化及意义。', caveat: '不是独立评测。', sourceIds: ['x:123'] }] } };
}
const config = { title: 'AI科技日报', description: '测试日报', baseUrl: 'https://example.github.io/ai-daily/', repositoryUrl: 'https://github.com/example/ai-daily' };

test('only a strict editorial whitelist reaches public output', () => {
  const result = JSON.stringify(publicReport(sample()));
  assert.equal(result.includes('DO_NOT_PUBLISH'), false);
  assert.equal(result.includes('PRIVATE_MODEL_ROUTE'), false);
  assert.equal(result.includes('公开编辑摘要'), true);
});
test('partial reports cannot masquerade as a new successful public issue', () => {
  const input = sample(); input.status = 'partial';
  assert.throws(() => publicReport(input));
});
test('statistics use an exact 24h window ending at noon in China', () => {
  const input = sample(); input.window.end = '2026-10-20T05:00:00Z';
  assert.throws(() => publicReport(input));
});
test('out-of-window and unknown references are rejected', () => {
  const input = sample(); input.candidates[0].publishedAt = input.window.end;
  assert.throws(() => publicReport(input));
  const unknown = sample(); unknown.digest.items[0].sourceIds = ['missing'];
  assert.throws(() => publicReport(unknown));
});
test('source links cannot carry credentials, signed queries or external domains', () => {
  assert.equal(sourceUrl('https://x.com/i/status/123?tracking=discard'), 'https://x.com/i/status/123');
  assert.throws(() => sourceUrl('https://user:private@x.com/i/status/123'));
  assert.throws(() => sourceUrl('https://attacker.invalid/i/status/123'));
  assert.throws(() => sourceUrl('javascript:alert(1)'));
});
test('editorial text is escaped; scripts come only from local assets', () => {
  const input = sample(); input.digest.items[0].title = '<script>unsafe()</script>';
  const html = issuePage(publicReport(input), config);
  assert.equal(html.includes('<script>unsafe()'), false);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('../../assets/site.css'));
  assert.ok(html.includes("default-src 'none'"));
});
test('homepage and RSS use the project Pages prefix instead of root-only links', () => {
  const report = publicReport(sample());
  assert.ok(issuePage(report, config, true).includes('./assets/site.js'));
  assert.ok(feedXml([report], config).includes('https://example.github.io/ai-daily/reports/2026-10-20/'));
});
