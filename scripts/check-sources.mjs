import process from 'node:process';
import {Buffer} from 'node:buffer';
const {fetch,AbortSignal}=globalThis;
import fs from 'node:fs/promises';
const previous=JSON.parse(await fs.readFile('docs/evidence/source-http-checks.json','utf8'));
const urls=[...previous.filter(x=>x.project!=='straw-rocket'),{project:'straw-rocket',url:'https://www.jpl.nasa.gov/edu/resources/project/make-a-straw-rocket/'}];
const results=[];
for(const record of urls){try{const response=await fetch(record.url,{signal:AbortSignal.timeout(15000)});const body=await response.text();results.push({project:record.project,url:record.url,status:response.status,bytes:Buffer.byteLength(body),title:body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??null,checkedAt:new Date().toISOString(),kind:'live_http_metadata_not_content_review'});}catch{results.push({project:record.project,url:record.url,error:'Request failed or timed out',checkedAt:new Date().toISOString()});}}
await fs.writeFile('docs/evidence/source-http-checks.json',JSON.stringify(results,null,2)+'\n');process.stdout.write(JSON.stringify({checked:results.length,http200:results.filter(r=>r.status===200).length})+'\n');if(results.some(r=>r.status!==200))process.exitCode=1;
