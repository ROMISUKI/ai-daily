export const editorialSections = [
  { id: 'frontier', name: '权威前沿', english: 'FRONTIER', description: '一手来源里的模型、研究与工程进展。' },
  { id: 'cases', name: '案例与玩法', english: 'BUILD & PLAY', description: '从有趣效果，拆到工具链、实现和复现边界。' },
  { id: 'opportunities', name: '商机观察', english: 'OPPORTUNITIES', description: '从真实需求出发，用小成本实验验证机会。' },
];

function readingScore(item) {
  const evidence = (item.sources ?? []).map((source) => source.evidence).join(' ');
  const coverage = /完整字幕轨|完整返回字幕轨|已读取所附允许域名页面/.test(evidence) ? 3 : /已读取原帖正文/.test(evidence) ? 1 : 0;
  const detail = ['howItWorks', 'evidenceBasis', 'nextStep', 'costAndRisks'].filter((field) => item[field]?.trim().length >= 30).length;
  return coverage + detail + Math.min(item.projects?.length ?? 0, 1) * 2;
}

// A reading aid based on the supplied editorial material, not a truth score,
// popularity ranking or a second model call. Ties retain the existing order.
export function selectHighlights(items) {
  return editorialSections.flatMap((section) => {
    const choices = items.map((item, index) => ({ item, index, section }))
      .filter(({ item }) => (item.section ?? '权威前沿') === section.name);
    choices.sort((a, b) => readingScore(b.item) - readingScore(a.item) || a.index - b.index);
    if (!choices.length) return [];
    const selected = choices[0];
    selected.reason = selected.item.projects?.length ? '含公开项目入口与分析线索' : selected.item.howItWorks ? '优先展开实现或需求依据' : '从本分区的来源与摘要读起';
    selected.id = `story-${selected.index + 1}`;
    return [selected];
  });
}

function article(item, index, section, highlighted, helpers) {
  const { escape, localTime } = helpers;
  const mainLabel = section.id === 'opportunities' ? '需求与机会依据' : '实现链路';
  const actionLabel = section.id === 'opportunities' ? '低成本验证' : '最小复现思路';
  const secondary = [['evidenceBasis', '已知与推测'], ['costAndRisks', '成本与风险']].filter(([field]) => item[field]);
  return `<article id="story-${index + 1}" class="topic stream-topic${highlighted ? ' topic-featured' : ''}" data-topic data-category="${escape(item.category)}" data-section="${escape(section.name)}"${highlighted ? ' data-highlight' : ''}>
    <div class="topic-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
    <div class="topic-body">
      <div class="topic-meta"><span class="eyebrow">${escape(item.category)}</span>${highlighted ? '<span class="priority-badge">分区先读</span>' : ''}</div>
      <h3>${escape(item.title)}</h3>
      <p class="summary">${escape(item.summary)}</p>
      <div class="meaning"><b>为什么值得看</b><p>${escape(item.whyItMatters)}</p></div>
      ${item.howItWorks ? `<section class="analysis-primary"><h4>${mainLabel}</h4><p>${escape(item.howItWorks)}</p></section>` : ''}
      ${item.nextStep ? `<section class="analysis-action"><h4>${actionLabel}</h4><p>${escape(item.nextStep)}</p></section>` : ''}
      ${secondary.length ? `<div class="analysis-secondary">${secondary.map(([field, label]) => `<section><h4>${label}</h4><p>${escape(item[field])}</p></section>`).join('')}</div>` : ''}
      <aside class="caveat"><b>边界与疑点</b><p>${escape(item.caveat)}</p></aside>
      ${item.projects?.length ? `<div class="project-links"><b>相关 GitHub 项目</b>${item.projects.map((project) => `<a href="${escape(project.url)}" target="_blank" rel="noopener noreferrer">${escape(project.name)} ↗</a><small>${escape(project.relationship)}</small>`).join('')}<small>已核验公开仓库页面；未执行代码，不等于安全审计或效果复现。</small></div>` : ''}
      <details class="evidence"><summary>原始来源与证据范围 <span>${item.sources.length} 条</span></summary><ul>${item.sources.map((source) => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.platform)} · ${escape(source.author)} ↗</a><time datetime="${source.publishedAt}">${escape(localTime(source.publishedAt))}</time><p>${escape(source.evidence)}</p></li>`).join('')}</ul></details>
    </div>
  </article>`;
}

export function renderIssue(report, config, prefix, latest, helpers) {
  const { escape, localTime, scheduleDescription, categories } = helpers;
  const highlights = selectHighlights(report.items);
  const highlighted = new Set(highlights.map(({ item }) => item));
  const counts = new Map(editorialSections.map((section) => [section.name, report.items.filter((item) => (item.section ?? '权威前沿') === section.name).length]));
  const navigation = editorialSections.map((section, index) => `<a class="stream-card card-${section.id}" href="#${section.id}" data-clear-filters><span class="section-dot" aria-hidden="true"></span><span class="stream-label"><small>0${index + 1}</small>${section.name}</span><b>${counts.get(section.name)}</b></a>`).join('');
  const groups = editorialSections.map((section, index) => {
    const items = report.items.filter((item) => (item.section ?? '权威前沿') === section.name);
    return `<section class="stream-section stream-${section.id}" id="${section.id}" data-stream><header class="section-heading"><span class="section-number">0${index + 1}</span><div><span class="eyebrow">${section.english}</span><h2>${section.name}<small>${items.length} 条</small></h2><p>${section.description}</p></div></header><div class="topic-list">${items.map((item) => article(item, report.items.indexOf(item), section, highlighted.has(item), helpers)).join('')}</div>${items.length ? '' : '<div class="section-empty">本期暂无这一分区的合格新条目，不用旧闻或未经核验的宣传凑数。</div>'}</section>`;
  }).join('');
  const filters = categories.filter((category) => report.items.some((item) => item.category === category));
  return `<section class="issue-hero" id="today">
      <div class="hero-top"><span class="edition">${latest ? '最新一期' : '历史日报'} / ${report.date}</span><a class="text-link" href="${prefix}archive/">按日期回看 ↗</a></div>
      <div class="hero-heading"><div><span class="hero-kicker">RESEARCH / BUILD / OPPORTUNITY</span><h1>看见前沿，拆开玩法。<br><em>把信号变成可验证的想法。</em></h1><p class="intro">前沿有据，玩法有解，机会有边界。先读重点，再展开每一条实现与来源。</p></div><div class="edition-mark" aria-hidden="true">DAILY<br><span>SIGNAL</span><i>↗</i></div></div>
      <div class="issue-stats"><span><strong>${report.items.length}</strong>条内容</span><span><strong>${report.candidateCount}</strong>候选线索</span><span class="window">${escape(localTime(report.window.start))} — ${escape(localTime(report.window.end))}<small>北京时间 · 严格24小时窗口</small></span></div>
    </section>
    ${report.status === 'partial' ? '<div class="coverage-alert"><b>本期存在来源或编辑批次缺项</b><p>只展示通过结构与引用校验的编辑结果；未完成部分不当作已分析，限制详见文末。</p></div>' : ''}
    <nav class="stream-overview" aria-label="日报分区">${navigation}</nav>
    ${highlights.length ? `<section class="spotlights" aria-labelledby="spotlight-heading"><div class="block-heading"><div><span class="eyebrow">START HERE</span><h2 id="spotlight-heading">本期先读<span>少一点寻找，多一点重点</span></h2></div><span class="reading-label">${highlights.length} 条阅读入口</span></div><div class="spotlight-grid">${highlights.map(({ item, index, section, reason, id }, order) => `<a class="spotlight-card spotlight-${section.id}${order === 0 ? ' spotlight-lead' : ''}" href="#${id}" data-spotlight-link data-clear-filters><div class="spotlight-meta"><span>${section.name}</span><span class="spotlight-number">${String(index + 1).padStart(2, '0')} ↗</span></div><h3>${escape(item.title)}</h3><p>${escape(item.whyItMatters)}</p><small>${escape(reason)}</small><span class="spotlight-action">展开这条内容 <span aria-hidden="true">→</span></span></a>`).join('')}</div><p class="selection-note">按现有来源覆盖与分析完整度辅助选择，不是事实认证、全局重要性排名或投资评级。</p></section>` : ''}
    <section class="takeaways"><div><span class="eyebrow">THE BIG PICTURE</span><h2>抓住本期信号</h2></div><div><ul>${report.takeaways.length ? report.takeaways.slice(0, 3).map((value) => `<li>${escape(value)}</li>`).join('') : '<li>本期尚无可归纳的新结论，请核对来源与覆盖范围。</li>'}</ul>${report.takeaways.length > 3 ? `<details class="more-takeaways"><summary>展开其余 ${report.takeaways.length - 3} 条观察</summary><ul>${report.takeaways.slice(3).map((value) => `<li>${escape(value)}</li>`).join('')}</ul></details>` : ''}</div></section>
    <section class="filter-panel" aria-label="筛选日报"><label class="search"><span>检索本期</span><input type="search" id="search" placeholder="模型、插件、MIDI、客户需求…" autocomplete="off"></label><div class="filters"><button type="button" class="active" data-filter="all" aria-pressed="true">全部 ${report.items.length}</button>${filters.map((category) => `<button type="button" data-filter="${escape(category)}" aria-pressed="false">${escape(category)}</button>`).join('')}</div><p id="filter-result" class="sr-only" aria-live="polite"></p></section>
    <div class="daily-layout"><aside class="issue-jump"><b>展开阅读</b>${editorialSections.map((section) => `<a href="#${section.id}" data-clear-filters>${section.name}<span>${counts.get(section.name)}</span></a>`).join('')}<p>高光条目带有<br><span class="priority-badge">分区先读</span><br>可先读，再展开其余内容。</p></aside><div class="stream-content">${groups}<p id="empty" class="empty" hidden>本期没有匹配内容，换个关键词试试。</p></div></div>
    <section class="reading-note"><h2>阅读边界与本期覆盖</h2><p>案例区分来源披露与合理推测。字幕、原帖和GitHub页面不等于逐帧观看、代码执行或效果复现；商机是待验证的需求信号，不是收益保证。没有项目地址就留空，不拿相似项目冒充作者源码。</p><p>${escape(scheduleDescription(config))}。不设整份日报的成稿条数上限，但采集、字幕和编辑受运行时间与来源可访问范围限制。本页生成于${escape(localTime(report.generatedAt))}，日期代表真实一期，不保证整点完成。</p>${report.coverage?.attempted ? `<p>本期采集与证据任务完成 ${report.coverage.succeeded}/${report.coverage.attempted} 项。</p>` : ''}${report.limitations?.length ? `<details><summary>查看 ${report.limitations.length} 项覆盖限制</summary><ul>${report.limitations.map((value) => `<li>${escape(value)}</li>`).join('')}</ul></details>` : ''}</section>`;
}
