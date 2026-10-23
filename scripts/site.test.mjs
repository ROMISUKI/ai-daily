import test from 'node:test';
import assert from 'node:assert/strict';
import { publicReport, issuePage, sourceUrl, feedXml, aboutPage, archivePage } from './site.mjs';
import { selectHighlights } from './streams.mjs';
import { inspectCodexPage } from './codex-page.mjs';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

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
  assert.ok(!html.includes('examples/'));
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
test('all public pages use the dark scheme and never expose the retired reference index', () => {
  const report = publicReport(sample());
  for (const html of [issuePage(report, config, true), issuePage(report, config), archivePage([report], config), aboutPage(config)]) {
    assert.ok(html.includes('name="color-scheme" content="dark"'));
    assert.ok(!html.includes('examples/'));
    assert.ok(!html.includes('兴趣案例索引'));
    assert.ok(!html.includes('你指定'));
    assert.ok(!/^[\t ]+$/m.test(html));
  }
});
test('reading highlights are bounded, deterministic, evidence-led and never mutate editorial data', () => {
  const items = [
    { section: '权威前沿', title: '只有简介', sources: [{ evidence: '仅标题/简介' }] },
    { section: '权威前沿', title: '来源与实现信息较完整', howItWorks: '实现链路'.repeat(12), sources: [{ evidence: '已读取原帖正文；已读取所附允许域名页面' }] },
    { section: '案例与玩法', title: '案例', sources: [{ evidence: '完整字幕轨' }] },
    { section: '商机观察', title: '机会', sources: [{ evidence: '已读取原帖正文' }] },
  ];
  const before = JSON.stringify(items);
  const selected = selectHighlights(items);
  assert.equal(selected.length, 3);
  assert.equal(selected[0].item.title, '来源与实现信息较完整');
  assert.equal(selected[0].id, 'story-2');
  assert.deepEqual(selectHighlights(items), selected);
  assert.equal(JSON.stringify(items), before);
  assert.deepEqual(selectHighlights([]), []);
});
test('highlights have textual badges, unique targets and explicit selection boundaries', () => {
  const report = publicReport(sample());
  const html = issuePage(report, config, true);
  assert.equal((html.match(/ data-highlight/g) ?? []).length, 1);
  assert.ok(html.includes('分区先读'));
  assert.ok(html.includes('href="#story-1"'));
  assert.ok(html.includes('id="story-1"'));
  assert.ok(html.includes('不是事实认证'));
  assert.ok(html.includes('data-clear-filters'));
});
test('implementation and action get primary emphasis while caveats remain visible', () => {
  const input = sample();
  Object.assign(input.digest.items[0], { howItWorks: '实际链路', nextStep: '验证步骤', evidenceBasis: '证据边界', costAndRisks: '风险' });
  const html = issuePage(publicReport(input), config, true);
  for (const value of ['analysis-primary', 'analysis-action', 'analysis-secondary', '边界与疑点']) assert.ok(html.includes(value));
  assert.ok(!html.includes('analysis-grid'));
});

test('Codex entry stays in the top-right navigation with correct relative links on every page', () => {
  const enabled = { ...config, codexMonitor: true }, report = publicReport(sample());
  for (const [html, prefix] of [[issuePage(report, enabled, true), './'], [issuePage(report, enabled), '../../'],
    [archivePage([report], enabled), '../'], [aboutPage(enabled), '../']]) {
    assert.ok(html.includes(`data-codex-entry href="${prefix}codex/"`));
    const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)[1];
    assert.ok(header.includes('data-codex-entry'));
  }
  assert.ok(!issuePage(report, config, true).includes('data-codex-entry'));
});

test('every shared page has one accessible back-to-top button outside its main content', () => {
  const report = publicReport(sample());
  for (const html of [issuePage(report, config, true), issuePage(report, config), archivePage([report], config), aboutPage(config)]) {
    assert.equal((html.match(/ data-back-to-top/g) ?? []).length, 1);
    assert.match(html, /<button[^>]+type="button"[^>]+data-back-to-top[^>]+aria-label="回到页面顶部"[^>]+hidden>/);
    assert.ok(html.indexOf('data-back-to-top') > html.indexOf('</main>'));
  }
});

test('back-to-top works without report filters, restores focus, and honors reduced motion', async () => {
  const script = await readFile(new URL('../web/site.js', import.meta.url), 'utf8');
  const windowEvents = new Map(), buttonEvents = new Map(), scrolls = [], focus = [];
  const button = { hidden: false, addEventListener: (name, handler) => buttonEvents.set(name, handler) };
  const brand = { focus: options => focus.push(options.preventScroll) };
  let reduced = false;
  const window = { scrollY: 0, addEventListener: (name, handler, options) => {
    if (name === 'scroll') assert.equal(options.passive, true);
    windowEvents.set(name, handler);
  }, matchMedia: () => ({ matches: reduced }), scrollTo: options => scrolls.push(options) };
  const document = { querySelector: selector => selector === '[data-back-to-top]' ? button : selector === '.brand' ? brand : null, querySelectorAll: () => [] };
  runInNewContext(script, { document, window });
  assert.equal(button.hidden, true);
  window.scrollY = 321; windowEvents.get('scroll')();
  assert.equal(button.hidden, false);
  buttonEvents.get('click')();
  assert.equal(scrolls[0].top, 0); assert.equal(scrolls[0].left, 0);
  assert.equal(scrolls[0].behavior, 'smooth'); assert.equal(focus[0], true);
  reduced = true; buttonEvents.get('click')();
  assert.equal(scrolls[1].behavior, 'instant');
  window.scrollY = 0; windowEvents.get('pageshow')();
  assert.equal(button.hidden, true);
});

function companion(snapshot) {
  return `<!doctype html><meta name="codex-reset-export" content="public-v1"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src https://codex-resets.com"><div id="calendar"></div><div id="entries"></div><script id="snapshot" type="application/json">${JSON.stringify(snapshot)}</script>`;
}
const companionSnapshot = () => ({ schemaVersion: 1, fetchedAt: '2026-10-22T04:00:00.000Z',
  coverage: { complete: true, rejected: 0 }, status: { scheduled_reset: null, active_watch: null }, records: [{
    id: '123', reset_type: 'regular', announced_at: '2026-10-20T06:00:00.000Z', text: '公开公告节选',
    source: { type: 'x_post', author: 'example', url: 'https://x.com/example/status/123' },
  }] });

test('companion publication accepts only the projected public schema and bounded excerpts', () => {
  assert.equal(inspectCodexPage(companion(companionSnapshot())).records, 1);
  for (const change of [value => { value.rawResponse = 'private'; }, value => { value.records[0].text = 'x'.repeat(281); },
    value => { value.records[0].source.url = 'https://evil.invalid/upload'; },
    value => { value.records[0].source.cookie = 'private'; }]) {
    const value = companionSnapshot(); change(value);
    assert.throws(() => inspectCodexPage(companion(value)));
  }
  assert.throws(() => inspectCodexPage(companion(companionSnapshot()) + '<script src="https://evil.invalid/script.js"></script>'));
});

test('scheduled announcements expose only audited metadata and safe original-post links', () => {
  const value = companionSnapshot();
  value.status.scheduled_reset = { id: '123', announced_at: '2026-10-22T06:55:54.000Z',
    scheduled_for: '2026-10-22T17:00:00.000Z', text: 'Lands tomorrow before 10am PST.', reset_type: 'regular',
    source: { type: 'x_post', author: 'thsottiaux', url: 'https://x.com/thsottiaux/status/123' } };
  assert.equal(inspectCodexPage(companion(value)).records, 1);
  const unknownTime = structuredClone(value); unknownTime.status.scheduled_reset.scheduled_for = null;
  assert.doesNotThrow(() => inspectCodexPage(companion(unknownTime)));
  for (const change of [scheduled => { scheduled.source.url = 'https://evil.invalid/'; },
    scheduled => { scheduled.source.raw = 'private'; }, scheduled => { scheduled.rawResponse = 'private'; },
    scheduled => { scheduled.announced_at = 'invalid'; }, scheduled => { scheduled.scheduled_for = 'invalid'; }]) {
    const changed = structuredClone(value); change(changed.status.scheduled_reset);
    assert.throws(() => inspectCodexPage(companion(changed)));
  }
});

test('direct author signals are bounded, exact-source metadata rather than raw X responses', () => {
  const value=companionSnapshot(),id='2113492187770175603';
  value.sourceCheck={source:'x_author',checkedAt:'2026-10-23T08:20:03Z',status:'ok',pagesRead:2,postsRead:40,coverage:'近期本人主帖与回复',limitation:'',historyStatus:'ok'};
  value.signals=[{id,author:'thsottiaux',url:`https://x.com/thsottiaux/status/${id}`,publishedAt:new Date(Number((BigInt(id)>>22n)+1288834974657n)).toISOString(),text:'Day 18/ that’s a reset!',contextId:null,truncated:false,kind:'announced',reason:'announcement_not_completion',resetType:'regular',excerpt:true}];
  assert.doesNotThrow(()=>inspectCodexPage(companion(value)));
  for(const change of [data=>{data.sourceCheck.rawResponse='private';},data=>{data.signals[0].author='other';},data=>{data.signals[0].url='https://evil.invalid/';},data=>{data.signals[0].text='x'.repeat(281);},data=>{data.signals[0].publishedAt='2026-01-01T00:00:00Z';},data=>{data.signals[0].cookies='private';}]){
    const changed=structuredClone(value);change(changed);assert.throws(()=>inspectCodexPage(companion(changed)));
  }
});
