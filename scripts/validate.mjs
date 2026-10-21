import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, sourceUrl, scheduleForDate } from './site.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'docs');
const config = JSON.parse(await readFile(join(root, 'site.config.json'), 'utf8'));
const permitted = /^(?:index\.html|archive\/index\.html|about\/index\.html|reports\/\d{4}-\d{2}-\d{2}\/index\.html|data\/reports\/\d{4}-\d{2}-\d{2}\.json|data\/index\.json|assets\/site\.(?:css|js)|\.nojekyll|feed\.xml|sitemap\.xml|robots\.txt)$/;
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Symbolic links are not allowed in public output.');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}
function keys(object, allowed) { if (!object || Object.keys(object).some((key) => !allowed.includes(key))) throw new Error('Unexpected field in public data.'); }
const names = await files(output);
for (const path of names) {
  const name = relative(output, path).replaceAll('\\', '/');
  if (!permitted.test(name)) throw new Error(`Unapproved public file: ${name}`);
  if ((await stat(path)).size > 1024 * 1024) throw new Error(`Public file is unexpectedly large: ${name}`);
  const body = await readFile(path, 'utf8');
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|SESSDATA\s*[:=]|bili_jct\s*[:=]|DedeUserID\s*[:=]|[A-Z]:[\\/](?:Users|OpenCodeTools)[\\/]|file:\/\/\/)/i.test(body)) throw new Error(`Private or local-only information detected: ${name}`);
  if (name.endsWith('.html')) {
    if (!body.includes("default-src 'none'") || !body.includes('viewport')) throw new Error('HTML security/mobile metadata is missing.');
    if (/<(?:iframe|object|embed|audio|video)\b/i.test(body) || /\son(?:click|load|error)\s*=/i.test(body)) throw new Error('Unapproved active content.');
    for (const match of body.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const link = match[1].replaceAll('&amp;', '&');
      if (/^(?:https?:|#)/.test(link)) continue;
      const target = new URL(link, 'https://local.invalid/' + name).pathname;
      const targetFile = join(output, decodeURIComponent(target.replace(/^\//, '')), target.endsWith('/') ? 'index.html' : '');
      if (!resolve(targetFile).startsWith(resolve(output) + '\\') && resolve(targetFile) !== resolve(output)) {
        // Keep the check portable on both Windows and the Linux CI runner.
        const rel = relative(output, targetFile);
        if (rel.startsWith('..')) throw new Error('Local link escapes public output.');
      }
      await stat(targetFile).catch(() => { throw new Error(`Broken local link: ${name} -> ${link}`); });
    }
  }
  if (/^data\/reports\//.test(name)) {
    const report = JSON.parse(body);
    keys(report, ['date', 'window', 'generatedAt', 'candidateCount', 'takeaways', 'items']);
    keys(report.window, ['start', 'end']);
    if (Date.parse(report.window.end) - Date.parse(report.window.start) !== 86400000 || Date.parse(report.window.end) !== Date.parse(`${report.date}T${scheduleForDate(report.date, config)}:00+08:00`)) throw new Error('Public report does not match its historical schedule.');
    if (!Array.isArray(report.items) || report.items.length < 1 || report.items.length > 10) throw new Error('Invalid topic count.');
    for (const item of report.items) {
      keys(item, ['title', 'category', 'summary', 'whyItMatters', 'caveat', 'sources']);
      if (!categories.includes(item.category)) throw new Error('Invalid public category.');
      for (const source of item.sources) {
        keys(source, ['author', 'platform', 'url', 'publishedAt', 'evidence']);
        sourceUrl(source.url);
        const value = Date.parse(source.publishedAt);
        if (!(value >= Date.parse(report.window.start) && value < Date.parse(report.window.end))) throw new Error('Public reference outside 24-hour window.');
      }
    }
  }
}
const index = JSON.parse(await readFile(join(output, 'data', 'index.json'), 'utf8'));
if (!index.issues?.length || index.latest !== index.issues[0].date) throw new Error('Latest report manifest is inconsistent.');
console.log(JSON.stringify({ valid: true, publicFiles: names.length, reports: index.issues.length, latest: index.latest, noPrivateDataDetected: true, localLinksValid: true }));
