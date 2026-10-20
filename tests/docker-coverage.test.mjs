import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JobQueue} from '../docker/jobs.mjs';
import {areas,searchLocation,listingLocality} from '../lib/airbnb/locations.mjs';
import {upcomingPeriods,rangePeriods} from '../lib/market-periods.mjs';

test('all 68 councils have bounded search locations; aliases preserve locality',()=>{
 assert.equal(areas.length,68);for(const area of areas)assert.ok(searchLocation(area).endsWith('--Malta'));
 assert.equal(listingLocality('Il-Belt Valletta'),'Valletta');assert.equal(listingLocality('Victoria, Gozo'),'Rabat (Gozo)');assert.equal(listingLocality('Xagħra'),'Xagħra (Gozo)');assert.throws(()=>searchLocation('https://example.com'));
});

test('date ranges reuse fortnight buckets, with real month ends and future sample dates',()=>{
 assert.deepEqual(rangePeriods('2026-10-02','2026-10-12'),{start:'2026-10-01',end:'2026-10-15'});
 assert.deepEqual(rangePeriods('2026-10-12','2026-10-15'),{start:'2026-10-01',end:'2026-10-15'});
 assert.deepEqual(rangePeriods('2028-02-20','2028-02-29'),{start:'2028-02-16',end:'2028-02-29'});
 assert.throws(()=>rangePeriods('2026-02-30','2026-03-01'));assert.throws(()=>rangePeriods('2026-10-15','2026-10-02'));
 const periods=upcomingPeriods(Date.parse('2026-10-15T09:00:00Z'));assert.equal(periods[0].start,'2026-10-16');assert.equal(periods[1].start,'2026-11-01');
 assert.ok(periods.every(p=>p.checkin>=p.start&&p.checkout<=new Date(Date.parse(p.end)+86400000).toISOString().slice(0,10)));
});

test('coverage respects rolling daily budget, caches samples, expands and pauses',async()=>{
 let now=Date.parse('2026-10-12T09:00:00Z'),calls=0;
 const queue=new JobQueue(':memory:',{now:()=>now,collect:async query=>{calls++;return {captures:[{query}]};},save:async captures=>({inserted:3,localityCounts:{[captures[0].query.area]:3}})});
 queue.coverage.configure({action:'coverage-start',dailyBudget:1});
 assert.equal(queue.list().coverage.cells.length,20);
 await queue.tick();await queue.tick();assert.equal(calls,1);assert.equal(queue.list().runs[0].matched,3);
 now+=86400000+1;await queue.tick();assert.equal(calls,2);assert.notEqual(queue.list().runs[0].search_id,queue.list().runs[1].search_id);
 queue.coverage.configure({action:'coverage-pause'});now+=86400000;await queue.tick();assert.equal(calls,2);
 now+=7*86400000;queue.coverage.configure({action:'coverage-resume'});assert.equal(new Set(queue.list().coverage.cells.map(c=>c.area)).size,68);
 await queue.tick();assert.equal(calls,3);queue.close();
});

test('empty and restricted searches do not trigger an unbounded retry cascade',async()=>{
 let now=Date.parse('2026-10-12T09:00:00Z');
 const queue=new JobQueue(':memory:',{now:()=>now,collect:async query=>({captures:[{query}]}),save:async()=>({inserted:0,localityCounts:{}})});
 queue.coverage.configure({action:'coverage-start',dailyBudget:2});await queue.tick();assert.equal(queue.list().runs[0].status,'empty');
 now+=31000;await queue.tick();assert.equal(queue.list().runs.length,2);queue.close();
 let calls=0;const blocked=new JobQueue(':memory:',{now:()=>now,collect:async()=>{calls++;throw Error('Site verification/access restriction');},save:async()=>{throw Error('must not save');}});
 blocked.coverage.configure({action:'coverage-start'});await blocked.tick();now+=60000;await blocked.tick();assert.equal(calls,1);assert.equal(blocked.list().coverage.restricted,true);blocked.close();
});

test('existing fresh samples prevent another collection in the same bucket; stale samples are refreshed',async()=>{
 let now=Date.parse('2026-10-12T09:00:00Z'),calls=0,seeded=false;
 const queue=new JobQueue(':memory:',{now:()=>now,coverageSamples:async cells=>{seeded=true;return [{id:cells[0].id,matched:8,refreshed:now-86400000}];},collect:async query=>{calls++;return {captures:[{query}]};},save:async captures=>({inserted:2,localityCounts:{[captures[0].query.area]:2}})});
 queue.coverage.configure({action:'coverage-start',dailyBudget:1});const first=queue.coverage.cells()[0].id;
 await queue.tick();assert.equal(seeded,true);assert.equal(calls,1);assert.notEqual(queue.list().runs[0].search_id,first);assert.equal(queue.coverage.cells().find(c=>c.id===first).status,'cached');
 queue.coverageSamples=undefined;now+=7*86400000;assert.notEqual(queue.coverage.cells().find(c=>c.id===first)?.status,'cached');queue.close();
});

test('resuming requeues cancelled work without waiting for the weekly refresh',async()=>{
 let now=Date.parse('2026-10-12T09:00:00Z'),calls=0;
 const queue=new JobQueue(':memory:',{now:()=>now,collect:async query=>{calls++;return {captures:[{query}]};},save:async captures=>({inserted:3,localityCounts:{[captures[0].query.area]:3}})});
 queue.coverage.configure({action:'coverage-start'});await queue.tick();now+=1000;await queue.tick();const pending=queue.list().runs.find(r=>r.status==='queued').search_id;
 queue.coverage.configure({action:'coverage-pause'});queue.coverage.cache(queue.coverage.cells().filter(c=>c.id!==pending).map(c=>({id:c.id,matched:5,refreshed:now})));
 queue.coverage.configure({action:'coverage-resume'});now+=31000;await queue.tick();assert.equal(calls,2);assert.equal(queue.list().runs[0].search_id,pending);assert.equal(queue.list().runs[0].status,'completed');queue.close();
});
