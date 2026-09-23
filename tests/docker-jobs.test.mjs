import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JobQueue} from '../docker/jobs.mjs';
const query={area:"St. Paul's Bay",checkin:'2026-09-25',checkout:'2026-09-27',adults:4,bedrooms:2,pages:1};
const capture={query};
test('scheduled runs roll stay dates, pause/resume, and persist across restart',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ownly-jobs-'));let now=Date.parse('2026-09-22T08:00:00Z');const seen=[];
 const dependencies={now:()=>now,collect:async q=>{seen.push(q);return {captures:[{query:q}]};},save:async()=>({inserted:3})};
 let queue=new JobQueue(path.join(dir,'jobs.sqlite'),dependencies);const id=queue.add({query,intervalDays:3});await queue.tick();assert.equal(queue.list().runs[0].status,'completed');
 now+=3*86400000;await queue.tick();assert.equal(seen[1].checkin,'2026-09-28');assert.equal(seen[1].checkout,'2026-09-30');queue.update(id,'pause');now+=3*86400000;await queue.tick();assert.equal(seen.length,2);
 queue.close();queue=new JobQueue(path.join(dir,'jobs.sqlite'),dependencies);assert.equal(queue.list().runs.length,2);queue.update(id,'resume');await queue.tick();assert.equal(seen.length,3);now+=86400000;queue.update(id,'run');await queue.tick();assert.equal(seen.at(-1).checkin,'2026-10-02');queue.close();fs.rmSync(dir,{recursive:true});
});
test('transient errors retry, restrictions stop and mismatched captures never save',async()=>{
 let now=Date.parse('2026-09-22T08:00:00Z'),calls=0,saved=0;
 const queue=new JobQueue(':memory:',{now:()=>now,collect:async()=>{calls++;if(calls===1)throw Error('Connection lost');return {captures:[capture]};},save:async()=>{saved++;return {inserted:1};}});
 queue.add({query,intervalDays:0});await queue.tick();assert.equal(queue.list().runs[0].status,'queued');now+=60001;await queue.tick();assert.equal(saved,1);queue.close();
 const blocked=new JobQueue(':memory:',{now:()=>now,collect:async()=>{throw Error('Site verification/access restriction');},save:async()=>{throw Error('must not save');}});blocked.add({query});await blocked.tick();assert.equal(blocked.list().runs[0].status,'failed');blocked.close();
 const wrong=new JobQueue(':memory:',{now:()=>now,collect:async()=>({captures:[{query:{...query,adults:2}}]}),save:async()=>{throw Error('must not save');}});wrong.add({query});await wrong.tick();assert.match(wrong.list().runs[0].error,/different search/);wrong.close();
});
