// Validate one explicitly selected, public-projected static companion page. Never inspect/copy its project tree.
export function inspectCodexPage(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > 1024 * 1024) throw new Error('Invalid Codex page size.');
  if (!html.includes('<meta name="codex-reset-export" content="public-v1">')
    || !html.includes('connect-src https://codex-resets.com')
    || !html.includes("default-src 'none'") || !html.includes('viewport')
    || !html.includes('id="calendar"') || !html.includes('id="entries"')) throw new Error('Expected public Codex export.');
  if (/<(?:iframe|object|embed|audio|video)\b/i.test(html) || /<script[^>]+src=/i.test(html)
    || /@import\b|https?:\/\/[^\s"']+\.(?:woff2?|ttf)/i.test(html)) throw new Error('Unexpected remote/embedded code in Codex page.');
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|SESSDATA\s*[:=]|bili_jct\s*[:=]|DedeUserID\s*[:=]|[A-Z]:[\\/](?:Users|OpenCodeTools|WebProjects)[\\/]|file:\/\/\/)/i.test(html)) {
    throw new Error('Private/local data in Codex page.');
  }
  const match = html.match(/<script id="snapshot" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Missing public Codex snapshot.');
  const data = JSON.parse(match[1]);
  const keys = (value, permitted) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !permitted.includes(key))) {
      throw new Error('Unexpected public Codex field.');
    }
  };
  keys(data, ['schemaVersion', 'fetchedAt', 'coverage', 'status', 'records', 'signals', 'sourceCheck']);
  if (data.schemaVersion !== 1 || !Number.isFinite(Date.parse(data.fetchedAt))
    || !Array.isArray(data.records) || data.records.length > 10000) throw new Error('Invalid public Codex snapshot.');
  keys(data.coverage, ['complete', 'rejected']);
  if (typeof data.coverage.complete !== 'boolean' || !Number.isSafeInteger(data.coverage.rejected) || data.coverage.rejected < 0) {
    throw new Error('Invalid public Codex coverage.');
  }
  keys(data.status, ['scheduled_reset', 'active_watch']);
  const excerpt = value => {
    if (typeof value !== 'string' || value.length > 280 || /https?:\/\//.test(value)) throw new Error('Expected a short public announcement excerpt.');
  };
  const source = value => {
    keys(value, ['type', 'author', 'url']);
    if (!['x_post', 'observed'].includes(value.type) || typeof value.author !== 'string'
      || value.author.length > 80) throw new Error('Invalid public Codex source.');
    if (value.url) {
      const url = new URL(value.url);
      if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)
        || url.username || url.password || url.port || url.search || url.hash
        || !/^\/[A-Za-z0-9_]+\/status\/\d+\/?$/.test(url.pathname)) throw new Error('Unapproved Codex original-post link.');
    }
  };
  if (data.status.scheduled_reset) {
    const scheduled = data.status.scheduled_reset;
    keys(scheduled, ['id', 'announced_at', 'scheduled_for', 'text', 'reset_type', 'source', 'time_basis']);
    excerpt(scheduled.text);
    if (!['regular', 'banked'].includes(scheduled.reset_type)
      || (scheduled.scheduled_for !== null && !Number.isFinite(Date.parse(scheduled.scheduled_for)))
      || (scheduled.announced_at != null && !Number.isFinite(Date.parse(scheduled.announced_at)))
      || (scheduled.id != null && (typeof scheduled.id !== 'string' || scheduled.id.length > 200))) {
      throw new Error('Invalid public Codex announcement.');
    }
    if (scheduled.source !== undefined) source(scheduled.source);
    if (scheduled.time_basis !== undefined && !['x_author','upstream'].includes(scheduled.time_basis)) throw new Error('Invalid announcement time basis.');
  }
  if (data.status.active_watch) {
    keys(data.status.active_watch, ['text', 'forecast_window', 'expires_at']);
    excerpt(data.status.active_watch.text);
  }
  for (const record of data.records) {
    keys(record, ['id', 'reset_type', 'announced_at', 'text', 'source']);
    if (typeof record.id !== 'string' || !['regular', 'banked'].includes(record.reset_type)
      || !Number.isFinite(Date.parse(record.announced_at))) throw new Error('Invalid public Codex record.');
    excerpt(record.text);
    source(record.source);
  }
  if (data.sourceCheck !== undefined) {
    const check = data.sourceCheck;
    keys(check,['source','checkedAt','status','pagesRead','postsRead','coverage','limitation','historyStatus']);
    if (check.source !== 'x_author' || !Number.isFinite(Date.parse(check.checkedAt))
      || !['ok','partial','unavailable'].includes(check.status)
      || !['ok','preserved'].includes(check.historyStatus)
      || !Number.isSafeInteger(check.pagesRead) || check.pagesRead < 0 || check.pagesRead > 20
      || !Number.isSafeInteger(check.postsRead) || check.postsRead < 0 || check.postsRead > 300
      || typeof check.coverage !== 'string' || check.coverage.length > 300
      || typeof check.limitation !== 'string' || check.limitation.length > 300) throw new Error('Invalid X source-check projection.');
  }
  if (data.signals !== undefined) {
    if (!data.sourceCheck || !Array.isArray(data.signals) || data.signals.length > 160) throw new Error('Invalid X signals.');
    for (const post of data.signals) {
      keys(post,['id','author','url','publishedAt','text','contextId','truncated','kind','reason','resetType','excerpt']);
      if (!/^\d{16,24}$/.test(post.id) || post.author !== 'thsottiaux'
        || post.url !== `https://x.com/thsottiaux/status/${post.id}`
        || !Number.isFinite(Date.parse(post.publishedAt))
        || Math.abs(Date.parse(post.publishedAt) - Number((BigInt(post.id)>>22n)+1288834974657n)) > 1
        || (post.contextId !== null && !/^\d{16,24}$/.test(post.contextId))
        || typeof post.truncated !== 'boolean' || post.excerpt !== true
        || !['scheduled','completed','announced','adjustment','uncertain'].includes(post.kind)
        || !['not_confirmed','future_wording','limited_compensation','explicit_completion','completion_in_reset_thread','announcement_not_completion','needs_context','truncated_text','conflicting_followup'].includes(post.reason)
        || !['regular','banked'].includes(post.resetType)) throw new Error('Invalid public author-post signal.');
      excerpt(post.text);
    }
  }
  return { fetchedAt: data.fetchedAt, records: data.records.length, publicProjection: true };
}
