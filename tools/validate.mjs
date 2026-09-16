/*
 * Validates the authored Extend app against extendreference:
 *   1. every .pmd/.pod/.amd/.smd/appManifest parses as strict JSON
 *   2. every "type" value is a known widget type
 *   3. every attribute on a widget is documented for that widget
 *   4. every taskReference.taskId resolves to an AMD task
 *   5. every include resolves to a .script file on disk
 */
import fs from 'node:fs';
import path from 'node:path';

const APP = process.argv[2] ?? 'canvasKitDemoExtend';
const REF = process.argv[3] ?? '../extendreference/reference';

for (const [label, p] of [['app bundle', APP], ['reference', REF]]) {
  if (!fs.existsSync(p)) {
    console.error(`No such ${label} directory: ${p}`);
    console.error('Usage: node tools/validate.mjs [appDir] [referenceDir]');
    process.exit(2);
  }
}

const attrs = JSON.parse(fs.readFileSync(path.join(REF, 'widget-attrs.json'), 'utf8'));
const known = new Set(attrs.knownTypes);

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(APP);

const jsonFiles = files.filter(f => /\.(pmd|pod|amd|smd|json)$/.test(f));
const scriptFiles = files.filter(f => f.endsWith('.script'));

const problems = [];
const parsed = new Map();

for (const f of jsonFiles) {
  const rel = path.relative(APP, f);
  try {
    parsed.set(rel, JSON.parse(fs.readFileSync(f, 'utf8')));
  } catch (err) {
    problems.push(`JSON PARSE  ${rel}: ${err.message}`);
  }
}

// Structural attributes that are containers/metadata rather than widget attributes.
const STRUCTURAL = new Set(['type', 'id', '_comment']);

const typeCounts = new Map();
const taskRefs = [];

function walkNode(node, rel, trail) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walkNode(n, rel, `${trail}[${i}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;

  const t = node.type;
  if (typeof t === 'string') {
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    if (!known.has(t)) {
      problems.push(`UNKNOWN TYPE  ${rel} ${trail}: "${t}"`);
    } else if (attrs.widgets[t]) {
      for (const k of Object.keys(node)) {
        if (STRUCTURAL.has(k)) continue;
        if (!attrs.widgets[t][k]) {
          problems.push(`UNDOCUMENTED ATTR  ${rel} ${trail}: ${t}.${k}`);
        }
      }
    }
  }

  if (node.taskReference && node.taskReference.taskId) {
    taskRefs.push({rel, trail, taskId: node.taskReference.taskId});
  }

  for (const [k, v] of Object.entries(node)) {
    walkNode(v, rel, `${trail}.${k}`);
  }
}

for (const [rel, doc] of parsed) walkNode(doc, rel, '$');

// AMD task ids
const amd = [...parsed.entries()].find(([r]) => r.endsWith('.amd'));
const taskIds = new Set((amd?.[1].tasks || []).map(t => t.id));
const pageIds = new Set((amd?.[1].tasks || []).map(t => t.page?.id));
for (const r of taskRefs) {
  if (!taskIds.has(r.taskId)) problems.push(`BAD taskId  ${r.rel} ${r.trail}: "${r.taskId}"`);
}

// Every AMD page must have a matching .pmd with that id
for (const [rel, doc] of parsed) {
  if (rel.endsWith('.pmd')) {
    const base = path.basename(rel, '.pmd');
    if (doc.id !== base) problems.push(`ID MISMATCH  ${rel}: id "${doc.id}" != filename "${base}"`);
    if (!pageIds.has(doc.id)) problems.push(`UNROUTED PAGE  ${rel}: no AMD task points at page "${doc.id}"`);
  }
}
for (const pid of pageIds) {
  if (![...parsed.keys()].some(r => r.endsWith(`${pid}.pmd`))) {
    problems.push(`MISSING PAGE  AMD routes to page "${pid}" but no ${pid}.pmd exists`);
  }
}

// includes resolve
const scriptNames = new Set(scriptFiles.map(f => path.basename(f)));
for (const [rel, doc] of parsed) {
  for (const inc of doc.include || []) {
    if (!scriptNames.has(inc)) problems.push(`BAD include  ${rel}: "${inc}" not found`);
  }
}

// pod references resolve
const podIds = new Set([...parsed.values()].filter(d => d.podId).map(d => d.podId));
for (const [rel, doc] of parsed) {
  const seen = [];
  (function findPods(n) {
    if (Array.isArray(n)) return n.forEach(findPods);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'pod' && n.podId) seen.push(n.podId);
    Object.values(n).forEach(findPods);
  })(doc);
  for (const p of seen) if (!podIds.has(p)) problems.push(`BAD podId  ${rel}: "${p}"`);
}

// 100 KB per presentation component
for (const f of jsonFiles.filter(f => /\.(pmd|pod)$/.test(f))) {
  const kb = fs.statSync(f).size / 1024;
  if (kb > 100) problems.push(`SIZE  ${path.relative(APP, f)}: ${kb.toFixed(1)} KB exceeds the 100 KB limit`);
}

console.log(`files: ${jsonFiles.length} JSON, ${scriptFiles.length} script`);
console.log(`widget types used: ${[...typeCounts.keys()].sort().join(', ')}`);
console.log('');
if (problems.length === 0) {
  console.log('PASS: no problems found');
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log('  ' + p);
  process.exitCode = 1;
}
