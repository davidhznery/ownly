import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {normalizeCapture,validateQuery} from '../lib/airbnb/normalize.ts';
const captures=[1,2,3,4,5].map(n=>JSON.parse(fs.readFileSync(new URL(`../lib/airbnb/airbnb-live-2026-09-18-page${n}.json`,import.meta.url))));
test('five real captures: 50 unique exact-stay listings, 31 locality matches, €166.50 median',()=>{
 const all=captures.flatMap(c=>normalizeCapture(c).quotes);const unique=[...new Map(all.map(q=>[q.listingId,q])).values()];assert.equal(unique.length,50);
 const prices=unique.filter(q=>q.locality==="St. Paul's Bay").map(q=>q.totalCents/100/q.nights).sort((a,b)=>a-b);assert.equal(prices.length,31);assert.equal(prices[15],166.5);assert.equal(prices[0],114);assert.equal(prices.at(-1),263.5);
 assert.ok(unique.every(q=>typeof q.listingId==='string'&&q.bedrooms===2&&q.adults===4&&q.nights===2));
});
const one=()=>({...structuredClone(captures[0]),cards:[structuredClone(captures[0].cards[1])]});
test('reject alternate dates, bedrooms, guests, malicious URL and ambiguous totals',()=>{
 for(const patch of [{checkin:'2026-09-26'},{bedrooms:3},{adults:'2'},{url:'https://evil.example/rooms/1276129788152111900'},{price_text:'€220 total €250 total'},{price_text:'€125 per night'}]){const c=one();Object.assign(c.cards[0],patch);assert.equal(normalizeCapture(c).quotes.length,0);}
});
test('discounted total and duplicated accessible text parse correctly',()=>{const c=one();c.cards[0].price_text='€329 €264 total €264 total';assert.equal(normalizeCapture(c).quotes[0].totalCents,26400);});
test('invalid dates, unbounded pages and unsupported area rejected',()=>{for(const patch of [{checkin:'2026-02-30'},{checkout:'2026-09-25'},{pages:6},{area:'https://example.com'}])assert.throws(()=>validateQuery({area:"St. Paul's Bay",checkin:'2026-09-25',checkout:'2026-09-27',adults:4,bedrooms:2,pages:1,...patch}));});
test('migration is additive and repeat observations cannot duplicate',()=>{
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('../drizzle/0003_chilly_queen_noir.sql',import.meta.url),'utf8'));
 const insert=db.prepare('INSERT OR IGNORE INTO airbnb_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let run=0;run<2;run++)for(const c of captures)for(const q of normalizeCapture(c).quotes)insert.run([q.listingId,q.checkin,q.checkout,q.adults,q.observedAt].join('|'),q.listingId,q.name,q.url,q.locality,q.propertyType,q.bedrooms,q.adults,q.checkin,q.checkout,q.nights,q.totalCents,q.observedAt,'test-user');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM airbnb_observations').get().n,50);db.close();
});
