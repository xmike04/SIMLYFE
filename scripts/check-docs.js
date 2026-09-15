#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const collectMarkdown = directory => readdirSync(resolve(root, directory), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory()
    ? collectMarkdown(`${directory}/${entry.name}`)
    : entry.name.endsWith('.md') ? [`${directory}/${entry.name}`] : []);
const files = ['README.md', 'AGENTS.md', 'CLAUDE.md', ...collectMarkdown('docs'),
  ...collectMarkdown('_agents/workflows'), ...collectMarkdown('.claude/commands'),
  ...['activities', 'job-school', 'relationships'].map(domain => `.agents/skills/simlyfe-${domain}/SKILL.md`),
  'src/tests/mechanics/README.md'];
const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts;
const errors = [];
let checked = 0;
const anchors = new Map();

function documentAnchors(file) {
  if (anchors.has(file)) return anchors.get(file);
  const headings = new Set();
  const counts = new Map();
  const markdown = readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  for (const [, title] of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = title.toLowerCase().replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}_\- ]/gu, '').trim().replaceAll(' ', '-');
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    headings.add(count ? `${base}-${count}` : base);
  }
  anchors.set(file, headings);
  return headings;
}

for (const file of files) {
  const markdown = readFileSync(resolve(root, file), 'utf8');
  // Code examples can contain bracket syntax that is not a document link.
  const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  for (const match of prose.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) continue;
    const [pathAndQuery, anchor] = target.split('#');
    const [path] = pathAndQuery.split('?');
    const resolved = path ? resolve(dirname(resolve(root, file)), decodeURIComponent(path)) : resolve(root, file);
    checked++;
    if (!existsSync(resolved)) errors.push(`${file}: missing linked file ${target}`);
    else if (anchor && extname(resolved) === '.md' && !documentAnchors(resolved).has(decodeURIComponent(anchor))) {
      errors.push(`${file}: missing Markdown heading ${target}`);
    }
  }
  for (const [, script] of markdown.matchAll(/\bnpm run ([\w:-]+)/g)) {
    if (!(script in scripts)) {
      errors.push(`${file}: unknown package script ${script}`);
    }
  }
}

// Catch obsolete architecture/test entry points as docs are moved between files.
const architecture = readFileSync(resolve(root, 'docs/architecture.md'), 'utf8');
for (const [, path] of architecture.matchAll(/`(src\/[\w./-]+\.(?:js|jsx))`/g)) {
  if (extname(path) && !existsSync(resolve(root, path))) errors.push(`docs/architecture.md: missing source ${path}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed: ${files.length} documents, ${checked} local links/anchors, package scripts, and architecture source paths.`);
}
