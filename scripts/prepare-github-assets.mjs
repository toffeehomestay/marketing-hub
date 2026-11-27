import {mkdir,copyFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const target=join(root,'dist-github');
await mkdir(target,{recursive:true});
for(const [source,destination] of [['github-secure.html','index.html'],['app.js','app.js'],['notes.js','notes.js'],['style.css','style.css'],['worker-client.js','worker-client.js']])await copyFile(join(root,source),join(target,destination));
