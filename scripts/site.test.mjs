import test from 'node:test';
import assert from 'node:assert/strict';
import { publicReport, issuePage, sourceUrl, feedXml, aboutPage, examplesPage } from './site.mjs';

function sample() {
  return { status: 'complete', date: '2026-10-20', generatedAt: '2026-10-20T04:48:00Z', window: { start: '2026-10-19T04:00:00Z', end: '2026-10-20T04:00:00Z' }, privateSentinel: 'DO_NOT_PUBLISH_INTERNAL_RECORDS', modelLabel: 'PRIVATE_MODEL_ROUTE', candidates: [{ id: 'x:123', author: '@example', platform: 'X', publishedAt: '2026-10-19T12:00:00Z', url: 'https://x.com/i/status/123', text: 'DO_NOT_PUBLISH_FULL_ORIGINAL', _media: ['DO_NOT_PUBLISH_MEDIA_URL'], evidence: { label: '仅原帖，未核验视频', text: 'DO_NOT_PUBLISH_RAW_TRANSCRIPT' } }], digest: { takeaways: ['需要核对原始来源。'], items: [{ title: '模型发布', category: '模型与研究', summary: '公开编辑摘要。', whyItMatters: '技术变化及意义。', caveat: '不是独立评测。', sourceIds: ['x:123'] }] } };
}
const config = { title: 'AI科技日报', description: '测试日报', baseUrl: 'https://example.github.io/ai-daily/', repositoryUrl: 'https://github.com/example/ai-daily' };
const updatedConfig = { ...config, schedule: '10:00', scheduleHistory: [{ from: '1970-01-01', time: '12:00' }, { from: '2026-10-22', time: '10:00' }] };

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
test('schedule transition accepts old noon issues and new 10am issues without rewriting history', () => {
  assert.equal(publicReport(sample(), updatedConfig).window.end, '2026-10-20T04:00:00.000Z');
  const input = sample();
  input.date = '2026-10-22';
  input.window = { start: '2026-10-21T02:00:00Z', end: '2026-10-22T02:00:00Z' };
  input.generatedAt = '2026-10-22T02:45:00Z';
  input.candidates[0].publishedAt = '2026-10-21T12:00:00Z';
  assert.equal(publicReport(input, updatedConfig).window.end, '2026-10-22T02:00:00.000Z');
  input.window = { start: '2026-10-21T04:00:00Z', end: '2026-10-22T04:00:00Z' };
  assert.throws(() => publicReport(input, updatedConfig));
  const html = issuePage(publicReport(sample(), updatedConfig), updatedConfig, true);
  assert.ok(html.includes('自2026-10-22起，每天北京时间10:00'));
  assert.ok(html.includes('10/20 12:00'));
  assert.ok(aboutPage(updatedConfig).includes('保留12:00截止的真实窗口'));
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
test('YouTube sources retain only the public video ID and never signed or tracking parameters', () => {
  assert.equal(sourceUrl('https://www.youtube.com/watch?v=abcdefghijk&tracking=discard&pot=discard'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(sourceUrl('https://youtu.be/abcdefghijk?t=30'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(sourceUrl('https://www.youtube.com/shorts/abcdefghijk'), 'https://www.youtube.com/watch?v=abcdefghijk');
  for (const value of ['https://youtube.com.evil.invalid/watch?v=abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk&v=anotherid11', 'https://www.youtube.com/playlist?list=private', 'https://www.youtube.com/feed/history']) assert.throws(() => sourceUrl(value));
  const input = sample();
  input.candidates[0].platform = 'YouTube';
  input.candidates[0].url = 'https://www.youtube.com/watch?v=abcdefghijk';
  const report = publicReport(input);
  assert.equal(report.items[0].sources[0].platform, 'YouTube');
  assert.equal(JSON.stringify(report).includes('DO_NOT_PUBLISH_RAW_TRANSCRIPT'), false);
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
test('three-section layout supports more than ten items and preserves verified project associations', () => {
  const input = sample();
  input.editorialVersion = 2;
  input.digest.items = Array.from({ length: 18 }, (_, index) => ({ ...input.digest.items[0], section: index < 6 ? '权威前沿' : index < 14 ? '案例与玩法' : '商机观察', sourceIds: ['x:' + index], howItWorks: '来源披露的步骤', nextStep: '小成本验证', projectUrls: [] }));
  input.candidates = input.digest.items.map((_, index) => ({ ...sample().candidates[0], id: 'x:' + index }));
  const report = publicReport(input);
  assert.equal(report.items.length, 18);
  const html = issuePage(report, config, true);
  for (const id of ['frontier', 'cases', 'opportunities']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('不设整份日报的成稿条数上限'));
  assert.ok(html.includes('examples/'));
  const project = { url: 'https://github.com/owner/project', name: 'owner/project', relationship: '来源所附仓库', verified: true, notes: 'DO_NOT_PUBLISH_RAW_README' };
  input.candidates[6].projects = [project];
  input.digest.items[6].projectUrls = [project.url];
  const withProject = publicReport(input);
  assert.equal(withProject.items[6].projects[0].url, project.url);
  assert.equal(JSON.stringify(withProject).includes('DO_NOT_PUBLISH_RAW_README'), false);
  input.digest.items[6].projectUrls = ['https://github.com/other/fake'];
  assert.throws(() => publicReport(input));
});
test('a partial v2 issue is publishable only when its editorial generation has validated', () => {
  const input = sample(); input.editorialVersion = 2; input.status = 'partial';
  assert.throws(() => publicReport(input));
  input.generationValidated = true;
  const html = issuePage(publicReport(input), config, true);
  assert.ok(html.includes('本期存在来源或编辑批次缺项'));
});
test('the active five-am configuration accepts legacy noon data without modifying dates', () => {
  const updated = { ...config, schedule: '05:00', scheduleHistory: [{ from: '1970-01-01', time: '12:00' }, { from: '2026-10-22', time: '05:00' }] };
  assert.equal(publicReport(sample(), updated).window.end, '2026-10-20T04:00:00.000Z');
  assert.ok(issuePage(publicReport(sample(), updated), updated, true).includes('每天北京时间05:00'));
});
