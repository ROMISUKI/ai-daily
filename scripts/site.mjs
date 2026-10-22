import { renderIssue, editorialSections } from './streams.mjs';
const DAY = 86400000;
export const categories = ['模型与研究', '开发工具与智能体', '机器人与硬件', '应用与产业', '技术解读', '音视频与创作', '游戏与仿真', '视觉与自动化', '产品与生意'];
export const sectionNames = editorialSections.map((section) => section.name);
export function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function text(value, maximum = 5000) {
  if (typeof value !== 'string' || value.length > maximum) throw new Error('Unexpected editorial text.');
  return value;
}
function iso(value) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp.'); return new Date(value).toISOString(); }
export function sourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Unapproved source URL.');
  if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) {
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' && url.searchParams.getAll('v').length === 1 ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    if (!/^[A-Za-z0-9_-]{11}$/.test(id ?? '')) throw new Error('Unapproved YouTube source URL.');
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (!((['www.bilibili.com', 'bilibili.com'].includes(url.hostname) && /^\/video\/BV[0-9A-Za-z]{10}\/?$/.test(url.pathname)) || (['x.com', 'twitter.com'].includes(url.hostname) && /^\/(?:i|[A-Za-z0-9_]{1,15})\/status\/\d+\/?$/.test(url.pathname)))) throw new Error('Unapproved source URL.');
  url.search = '';
  url.hash = '';
  return url.href;
}
export function scheduleForDate(date, config = {}) {
  let time = config.schedule ?? '12:00';
  for (const change of [...(config.scheduleHistory ?? [])].sort((a, b) => a.from.localeCompare(b.from))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(change.from) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(change.time)) throw new Error('Invalid schedule history.');
    if (change.from <= date) time = change.time;
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid daily schedule.');
  return time;
}
export function scheduleDescription(config) {
  const latest = [...(config.scheduleHistory ?? [])].sort((a, b) => a.from.localeCompare(b.from)).at(-1);
  return `${latest ? `自${latest.from}起，` : ''}每天北京时间${config.schedule ?? '12:00'}开始收集前24小时的公开来源`;
}
export function publicReport(input, config = {}) {
  if (input.status !== 'complete' && !(input.status === 'partial' && input.editorialVersion === 2 && input.generationValidated === true)) throw new Error('Only validated editorial reports can be published.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Invalid report date.');
  const start = iso(input.window?.start), end = iso(input.window?.end);
  const expectedEnd = Date.parse(`${input.date}T${scheduleForDate(input.date, config)}:00+08:00`);
  if (Date.parse(end) - Date.parse(start) !== DAY || Date.parse(end) !== expectedEnd) throw new Error('Unexpected 24-hour report window.');
  if (!Array.isArray(input.digest?.items) || !Array.isArray(input.digest.takeaways)) throw new Error('Invalid editorial report.');
  const sources = new Map((input.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  const used = new Set();
  const items = input.digest.items.map((item) => {
    if (!categories.includes(item.category) || !Array.isArray(item.sourceIds) || !item.sourceIds.length) throw new Error('Invalid report topic.');
    const references = item.sourceIds.map((id) => {
      if (used.has(id)) throw new Error('Duplicate report reference.');
      used.add(id);
      const source = sources.get(id);
      if (!source) throw new Error('Unknown report reference.');
      const publishedAt = iso(source.publishedAt);
      if (publishedAt < start || publishedAt >= end) throw new Error('Reference outside report window.');
      return { author: text(source.author, 160), platform: ['B站', 'X', 'YouTube'].includes(source.platform) ? source.platform : '原来源', url: sourceUrl(source.url), publishedAt, evidence: text(source.evidence?.label ?? '仅原帖/简介，媒体未核验', 600) };
    });
    const section = item.section ?? '权威前沿';
    if (!sectionNames.includes(section)) throw new Error('Invalid editorial section.');
    const allowedProjects = new Map(item.sourceIds.flatMap((id) => (sources.get(id)?.projects ?? []).filter((project) => project.verified === true).map((project) => [project.url, project])));
    const projects = (item.projectUrls ?? []).map((url) => {
      const project = allowedProjects.get(url);
      if (!project || githubUrl(url) !== url) throw new Error('Unverified GitHub link in editorial output.');
      return { url, name: text(project.name, 160), relationship: text(project.relationship ?? '原来源提及的公开仓库，关联范围需核对', 600) };
    });
    return { section, title: text(item.title, 400), category: item.category, summary: text(item.summary), whyItMatters: text(item.whyItMatters), caveat: text(item.caveat), howItWorks: text(item.howItWorks ?? ''), evidenceBasis: text(item.evidenceBasis ?? ''), nextStep: text(item.nextStep ?? ''), costAndRisks: text(item.costAndRisks ?? ''), projects, sources: references };
  });
  return { date: input.date, window: { start, end }, generatedAt: iso(input.generatedAt), candidateCount: sources.size, status: input.status, limitations: (input.warnings ?? []).map((value) => text(value, 1500)), coverage: { attempted: Number(input.coverage?.attempted) || 0, succeeded: Number(input.coverage?.succeeded) || 0 }, takeaways: input.digest.takeaways.slice(0, 9).map((value) => text(value, 1500)), items };
}
export function githubUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || !/^\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(url.pathname) || url.search || url.hash) throw new Error('Invalid public repository URL.');
  return url.href;
}
export function localTime(value) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
function layout(config, { title, body, prefix = './', description = config.description, canonicalPath = '' }) {
  const canonical = new URL(canonicalPath, config.baseUrl).href;
  const toolLink = config.codexMonitor ? `<a class="codex-entry" data-codex-entry href="${prefix}codex/" aria-label="打开 Codex 重置观测台"><span class="codex-label">Codex </span>重置 <span aria-hidden="true">↗</span></a>` : '';
  const backToTop = '<button class="back-to-top" type="button" data-back-to-top aria-label="回到页面顶部" title="回到顶部" hidden><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 4h14M12 20V8m-6 6 6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>置顶</span></button>';
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(description)}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#090f1b"><title>${escape(title)} · ${escape(config.title)}</title><link rel="canonical" href="${escape(canonical)}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="alternate" type="application/rss+xml" title="${escape(config.title)}" href="${prefix}feed.xml"><script src="${prefix}assets/site.js" defer></script></head><body><header class="site-header"><a class="brand" href="${prefix}"><span class="brand-mark" aria-hidden="true">AI</span><span>科技日报<small>THE DAILY SIGNAL</small></span></a><nav class="${config.codexMonitor ? 'with-tools' : ''}" aria-label="主导航"><a href="${prefix}#today">最新一期</a><a href="${prefix}archive/">历史归档</a><a href="${prefix}about/">关于</a><a href="${prefix}feed.xml">RSS</a>${toolLink}</nav></header><main>${body}</main><footer class="site-footer"><p>AI 辅助整理 · 以原始来源为准 · 非投资建议或收益保证</p><p><a href="${prefix}about/">来源与阅读说明</a><span> / </span><a href="${escape(config.repositoryUrl)}" target="_blank" rel="noopener noreferrer">GitHub 开源</a></p></footer>${backToTop}</body></html>\n`;
}
function topics(report, prefix) {
  return `<section class="filter-panel" aria-label="筛选日报"><label class="search"><span>检索本期</span><input type="search" id="search" placeholder="搜索模型、机构、技术关键词…" autocomplete="off"></label><div class="filters"><button type="button" class="active" data-filter="all" aria-pressed="true">全部 ${report.items.length}</button>${categories.filter((category) => report.items.some((item) => item.category === category)).map((category) => `<button type="button" data-filter="${escape(category)}" aria-pressed="false">${escape(category)}</button>`).join('')}</div><p id="filter-result" class="sr-only" aria-live="polite"></p></section><section class="topic-list" id="topics">${report.items.map((item, index) => `<article class="topic" data-topic data-category="${escape(item.category)}"><div class="topic-index">${String(index + 1).padStart(2, '0')}</div><div class="topic-body"><span class="eyebrow">${escape(item.category)}</span><h2>${escape(item.title)}</h2><p class="summary">${escape(item.summary)}</p><div class="meaning"><b>为什么值得看</b><p>${escape(item.whyItMatters)}</p></div><div class="caveat"><b>边界与疑点</b><p>${escape(item.caveat)}</p></div><details class="evidence"><summary>原始来源与证据范围 <span>${item.sources.length} 条</span></summary><ul>${item.sources.map((source) => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.platform)} · ${escape(source.author)} <span aria-hidden="true">↗</span></a><time datetime="${source.publishedAt}">${escape(localTime(source.publishedAt))}</time><p>${escape(source.evidence)}</p></li>`).join('')}</ul></details></div></article>`).join('')}</section><p id="empty" class="empty" hidden>本期没有匹配的主题。换一个关键词试试。</p>`;
}
function issueBody(report, config, prefix, latest = false) {
  return `<section class="issue-hero" id="today"><div class="hero-top"><span class="edition">${latest ? '最新一期' : '历史日报'} / ${report.date}</span><a class="text-link" href="${prefix}archive/">查看历史归档 →</a></div><h1>抓住 AI 变化中的<br><em>真正信号。</em></h1><p class="intro">每日梳理 AI 研究、模型与开发工具。少一点信息噪声，多一点技术细节与来源。</p><div class="issue-stats"><span><strong>${report.items.length}</strong>精选主题</span><span><strong>${report.candidateCount}</strong>候选内容</span><span class="window">统计：${escape(localTime(report.window.start))} — ${escape(localTime(report.window.end))}<small>北京时间 · 发布时间严格限定于过去24小时</small></span></div></section><section class="takeaways"><div><span class="eyebrow">THE BIG PICTURE</span><h2>今天，先看这几件事</h2></div><ul>${report.takeaways.map((value) => `<li>${escape(value)}</li>`).join('')}</ul></section>${topics(report, prefix)}<section class="reading-note"><h2>如何阅读这份日报</h2><p>原帖、平台字幕和自动语音识别都不是人工事实核查。每条主题标明证据覆盖；官方宣传、演示与独立实测并不等价。未逐帧核验的视频，不被视为完整观看。</p><p>本页生成于 ${escape(localTime(report.generatedAt))}（北京时间）。${escape(scheduleDescription(config))}，遇到网络或来源故障可能延迟；页面日期代表最近一次成功发布，而非保证今天已有更新。历史各期保留生成当时的真实统计窗口。</p></section>`;
}
export function issuePage(report, config, latest = false) {
  return layout(config, { title: latest ? `最新一期 · ${report.date}` : report.date, body: renderIssue(report, config, latest ? './' : '../../', latest, { escape, localTime, scheduleDescription, categories }).replace(/^[\t ]+$/gm, ''), prefix: latest ? './' : '../../', canonicalPath: `reports/${report.date}/` });
}
export function archivePage(reports, config) {
  return layout(config, { title: '历史归档', prefix: '../', canonicalPath: 'archive/', body: `<section class="page-heading"><span class="eyebrow">ARCHIVE</span><h1>把每天的信号，<br>留成可回看的记录。</h1><p>共 ${reports.length} 期。日期按北京时间统计窗口截止时间归档。</p></section><section class="archive-list">${reports.map((report) => `<a class="archive-item" href="../reports/${report.date}/"><time>${report.date}</time><div><h2>${report.items.length} 个主题 · AI 科技日报</h2><p>${escape(report.items.slice(0, 3).map((item) => item.title).join(' / '))}</p></div><span aria-hidden="true">↗</span></a>`).join('')}</section>` });
}
export function aboutPage(config) {
  return layout(config, { title: '关于与来源说明', prefix: '../', canonicalPath: 'about/', body: `<section class="page-heading"><span class="eyebrow">ABOUT THIS PROJECT</span><h1>信息很多，<br>判断比堆砌更重要。</h1><p>${escape(config.description)}</p></section><section class="prose">
    <h2>三条信息线</h2><p>权威前沿优先官方研究机构、技术研究者与专业来源。案例与玩法拆解插件、音视频/MIDI、游戏、视觉和自动化的实现链路。商机观察包含AI及非AI需求，分析客户痛点、验证方法与风险，不承诺收入或项目获批。</p>
    <h2>先读与高光</h2><p>每个非空分区选一条阅读入口，优先考虑现有来源覆盖、实现细节与验证思路的完整度。高光是帮助阅读的导航，不是全局重要性排名、真实性认证或投资评级。其余条目仍完整保留，搜索与筛选不会缩减成稿数量。</p>
    <h2>如何生成</h2><p>${escape(scheduleDescription(config))}，按精确发布时间过滤并合并同一事件。2026-10-21及此前各期仍保留12:00截止的真实窗口，调整时间不会改写旧稿。不设整份日报的成稿条数上限，但来源、字幕、链接和编辑有运行预算，不能穷举全网或保证准时发布。只发布通过编辑与引用校验的结果，缺项明确标注。</p>
    <h2>案例与代码</h2><p>实现拆解区分来源披露与推测。GitHub链接来自相应来源且已核验为公开仓库，说明作者项目、底层参考或依赖的关系，不拿同类项目冒充原实现。没有自动安装或执行项目，不把页面核验当作代码安全审计。</p>
    <h2>证据与准确性</h2><p>原帖、平台AI字幕和音轨ASR都可能错误，明显错配的字幕会弃用。未逐帧审查画面，也未逐音符核验音乐或独立复现纪录。官方性能宣传、作者收入自述和可复核结果并不等价，重要决策请核对原文及更多证据。</p>
    <h2>版权、隐私与反馈</h2><p>本站只提供编辑摘要与来源链接，不托管原视频、全文字幕、完整抓取数据或登录信息。不注册用户，不嵌入第三方统计或远程字体。相关材料权利归各自权利人，托管平台及原始来源仍有各自政策。纠错或权利问题请在 <a href="${escape(config.repositoryUrl)}/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a> 提供日期、主题及依据，不提交私人数据。</p></section>` });
}
export function feedXml(reports, config) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0"><channel><title>${escape(config.title)}</title><link>${escape(config.baseUrl)}</link><description>${escape(config.description)}</description><language>zh-CN</language>${reports.slice(0, 30).map((report) => { const url = new URL(`reports/${report.date}/`, config.baseUrl).href; return `<item><title>${report.date} · ${report.items.length}个AI科技主题</title><link>${escape(url)}</link><guid isPermaLink="true">${escape(url)}</guid><pubDate>${new Date(report.generatedAt).toUTCString()}</pubDate><description>${escape(report.takeaways.join('\n'))}</description></item>`; }).join('')}</channel></rss>\n`;
}
