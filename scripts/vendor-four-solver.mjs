// Rebuild with: node scripts/vendor-four-solver.mjs /path/to/cubesmith-scrambler-0.14.1.tgz
// Obtain the exact upstream archive with: npm pack @cubesmith/scrambler@0.14.1
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const archive = process.argv[2];
if (!archive) throw new Error('Pass the @cubesmith/scrambler@0.14.1 npm archive');
const extract = file => execFileSync('tar', ['-xOf', archive, `package/${file}`], { maxBuffer: 2_000_000 }).toString();
const metadata = JSON.parse(extract('package.json'));
if (metadata.name !== '@cubesmith/scrambler' || metadata.version !== '0.14.1') throw new Error('Unexpected upstream version');
const upstream = extract('dist/index.js');
const marker = upstream.indexOf('// src/index.ts');
if (marker < 0) throw new Error('Upstream entry marker missing');
const exports = 'solve444, prepare444Tables, pieces444, move444Tables, apply444Moves, randomCube444State, createRandomSource';
const source = upstream.slice(0, marker) + `\nexport { ${exports} };\n`;
const output = await build({
  stdin: { contents: source, loader: 'js' }, bundle: true, format: 'esm',
  treeShaking: true, write: false, target: 'es2022',
  banner: { js: `// Derived from @cubesmith/scrambler 0.14.1 (MIT). See LICENSE and README.md.\n// Upstream dist/index.js SHA-256: ${createHash('sha256').update(upstream).digest('hex')}` },
});
const directory = new URL('../src/vendor/four-solver/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('engine.js', directory), output.outputFiles[0].text);
await writeFile(new URL('LICENSE', directory), extract('LICENSE'));
// Store only the small piece topology in the UI bundle. Search tables stay in the solver Worker.
const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const p = api.pieces444();
const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
const cell = f => {
  const [x, y, z] = f.position.map((v, i) => v - f.normal[i]);
  const [r, c] = {
    U: [(z + 3) / 2, (x + 3) / 2], R: [(3 - y) / 2, (3 - z) / 2],
    F: [(3 - y) / 2, (x + 3) / 2], D: [(3 - z) / 2, (x + 3) / 2],
    L: [(3 - y) / 2, (z + 3) / 2], B: [(3 - y) / 2, (3 - x) / 2],
  }[f.face];
  return faces.indexOf(f.face) * 16 + r * 4 + c;
};
const canonical = p.facelets.map(cell);
await writeFile(new URL('topology.json', directory), JSON.stringify({
  corners: p.cornerFacelets.map(ids => ids.map(id => canonical[id])),
  wings: p.wingFacelets.map(ids => ids.map(id => canonical[id])),
  centres: p.centreFacelets.map(id => canonical[id]),
  faces: ['U', 'D', 'F', 'B', 'L', 'R'],
}, null, 2) + '\n');
console.log('Vendored MIT four-layer solver and canonical piece topology.');
