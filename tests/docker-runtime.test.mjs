import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRuntime,identityHeaders} from '../docker/runtime.mjs';
import {JobQueue} from '../docker/jobs.mjs';
// Real workerd + persistent D1. Only the remote collection transport is a fixture.
test('real runtime: queued capture -> application import -> persistent results after restart',{timeout:30000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ownly-runtime-'));const email='test@example.test';const headers=identityHeaders(email);let mf=await createRuntime({dataDir:dir,adminEmail:email});
 try{
 let response=await mf.dispatchFetch('http://localhost/admin/airbnb',{headers});assert.equal(response.status,200);assert.match(await response.text(),/Automatic search schedules/);
 response=await mf.dispatchFetch('http://localhost/api/admin/airbnb');assert.equal(response.status,403);
 const captures=[1,2,3,4,5].map(n=>JSON.parse(fs.readFileSync(`lib/airbnb/airbnb-live-2026-09-18-page${n}.json`,'utf8')));
 const queue=new JobQueue(path.join(dir,'jobs.sqlite'),{now:()=>Date.parse('2026-09-22T08:00:00Z'),collect:async()=>({captures}),save:async captures=>{const r=await mf.dispatchFetch('http://localhost/api/admin/airbnb',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'import',captures})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}});
 queue.add({query:{area:"St. Paul's Bay",...captures[0].query,pages:5},intervalDays:0});await queue.tick();assert.equal(queue.list().runs[0].status,'completed');assert.equal(queue.list().runs[0].inserted,50);queue.close();
 await mf.dispose();mf=await createRuntime({dataDir:dir,adminEmail:email});
 const params=new URLSearchParams({area:"St. Paul's Bay",checkin:'2026-09-25',checkout:'2026-09-27',adults:'4',bedrooms:'2'});
 response=await mf.dispatchFetch('http://localhost/api/admin/airbnb?'+params,{headers});const data=await response.json();assert.equal(response.status,200);assert.equal(data.rows.length,31);assert.equal(data.totalStored,50);assert.equal(data.rows[15].total_cents/100/data.rows[15].nights,166.5);
 }finally{await mf.dispose();fs.rmSync(dir,{recursive:true,force:true});}
});
