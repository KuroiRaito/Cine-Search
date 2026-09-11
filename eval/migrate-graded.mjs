// One-off: binary expected[] -> graded expected[{key, grade}].
// Auto-resolved known-item answers become grade 3 (perfect) - they are the
// single correct title by construction.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const f = join(dirname(fileURLToPath(import.meta.url)), 'queries.json');
const d = JSON.parse(readFileSync(f, 'utf8'));
let migrated = 0;
for (const q of d.queries) {
    if (!Array.isArray(q.expected)) { q.expected = []; continue; }
    q.expected = q.expected.map((e) => {
        if (e && typeof e === 'object') return e;
        migrated++;
        return { key: e, grade: 3 };
    });
}
d.schema = 2;
writeFileSync(f, JSON.stringify(d, null, 2));
console.log(`  migrated ${migrated} labels to graded (schema 2)`);
