import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='extensions/customer-invoices/dist';
const file=fs.readdirSync(root,{recursive:true}).find(name=>name.endsWith('customer-invoices.metafile.json'));
assert.ok(file,'Run npm run build first');
const inputs=Object.keys(JSON.parse(fs.readFileSync(`${root}/${file}`,'utf8')).inputs);
assert.ok(inputs.some(name=>name.includes('preact/jsx-runtime/')),'Extension must use Preact JSX runtime');
assert.ok(!inputs.some(name=>/(^|\/)react\//.test(name)),'React must not be bundled with the Preact extension');
console.log('Extension runtime verified: Preact JSX runtime present; incompatible React runtime absent.');
