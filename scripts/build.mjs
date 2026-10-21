import { readFile, writeFile, readdir, mkdir, rename, copyFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { publicReport, issuePage, archivePage, aboutPage, examplesPage, feedXml } from './site.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const index = args.indexOf('--reports-dir');
if (index < 0 || !args[index + 1]) throw new Error('Usage: node scripts/build.mjs --reports-dir <private-local-report-directory>');
const source = resolve(args[index + 1]);
const output = join(root, 'docs');
const config = JSON.parse(await readFile(join(root, 'site.config.json'), 'utf8'));
const names = (await readdir(source)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const reports = [];
let skipped = 0;
for (const name of names) {
  const input = JSON.parse(await readFile(join(source, name), 'utf8'));
  if (input.status !== 'complete' && !(input.status === 'partial' && input.editorialVersion === 2 && input.generationValidated === true)) { skipped++; continue; }
  reports.push(publicReport(input, config));
}
reports.sort((a, b) => b.date.localeCompare(a.date));
if (!reports.length) throw new Error('No completed report is eligible for public publication.');
await mkdir(output, { recursive: true });
async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, value, 'utf8');
  await rename(temp, path);
}
await atomic(join(output, '.nojekyll'), '');
await mkdir(join(output, 'assets'), { recursive: true });
for (const file of ['site.css', 'site.js']) await copyFile(join(root, 'web', file), join(output, 'assets', file));
for (const report of reports) {
  await atomic(join(output, 'reports', report.date, 'index.html'), issuePage(report, config));
  await atomic(join(output, 'data', 'reports', report.date + '.json'), JSON.stringify(report, null, 2) + '\n');
}
await atomic(join(output, 'index.html'), issuePage(reports[0], config, true));
await atomic(join(output, 'archive', 'index.html'), archivePage(reports, config));
await atomic(join(output, 'about', 'index.html'), aboutPage(config));
await atomic(join(output, 'examples', 'index.html'), examplesPage(JSON.parse(await readFile(join(root, 'reference-cases.json'), 'utf8')), config));
await atomic(join(output, 'feed.xml'), feedXml(reports, config));
await atomic(join(output, 'data', 'index.json'), JSON.stringify({ latest: reports[0].date, issues: reports.map((report) => ({ date: report.date, topics: report.items.length, generatedAt: report.generatedAt, path: `reports/${report.date}/` })) }, null, 2) + '\n');
await atomic(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', config.baseUrl).href}\n`);
await atomic(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'archive/', 'about/', 'examples/', ...reports.map((report) => `reports/${report.date}/`)].map((path) => `<url><loc>${new URL(path, config.baseUrl).href}</loc></url>`).join('')}</urlset>\n`);
console.log(JSON.stringify({ reports: reports.length, latest: reports[0].date, topics: reports[0].items.length, incompleteSkipped: skipped, privateDataPublished: false }));
