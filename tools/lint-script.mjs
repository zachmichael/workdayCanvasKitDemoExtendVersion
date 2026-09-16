/*
 * Static lint for the PMD-script gotchas documented in
 * reference/api/pmd-scripting/syntax.md. These are all things that look like
 * valid JavaScript and are not valid PMD script.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2] ?? 'canvasKitDemoExtend/presentation';
if (!fs.existsSync(DIR)) {
  console.error(`No such directory: ${DIR}. Run from the app root, or pass the path.`);
  process.exit(2);
}

const RULES = [
  {re: /=\s*\{\s*\}/g, msg: '{} declares a Set; an empty map is {:}'},
  {re: /for\s*\([^)]*\bin\b[^)]*\)/g, msg: 'for-each uses a colon: for (let x : list)'},
  {re: /\bempty\s+[A-Za-z_$]/g, msg: 'empty is a function: empty(x)'},
  {re: /\.length\b/g, msg: 'use size(x), not .length'},
  {re: /\$\{/g, msg: 'interpolation is {{ }} inside backticks, not ${ }'},
  {re: /\b(and|or|not)\s*\(/g, msg: 'and/or/not are reserved words; use && || !'},
  {re: /=>\s*[^{\s]/g, msg: 'closure bodies need braces: x => { ... }'},
  {re: /\bconsole\.log\b/g, msg: 'PMD logging is console.info / console.debug'},
  {re: /\bJSON\.(parse|stringify)\b/g, msg: 'use json: namespace functions'},
  {re: /\bnew\s+Date\b/g, msg: 'use the date: namespace'},
];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.script')) files.push(p);
  }
})(DIR);

let found = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return;
    for (const r of RULES) {
      r.re.lastIndex = 0;
      if (r.re.test(line)) {
        console.log(`${path.basename(f)}:${i + 1}  ${r.msg}`);
        console.log(`    ${trimmed}`);
        found++;
      }
    }
  });
}

console.log('');
console.log(found === 0 ? `PASS: ${files.length} script module(s), no JS-isms found` : `${found} issue(s)`);
if (found) process.exitCode = 1;
