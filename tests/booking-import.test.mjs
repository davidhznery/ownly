import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {listingQuery} from '../lib/market-listings.mjs';
const hook=registerHooks({resolve(specifier,context,nextResolve){return nextResolve(specifier==='./normalize'&&context.parentURL?.endsWith('/lib/airbnb/import.ts')?'./normalize.ts':specifier,context);}});
const {normalizeRows}=await import('../lib/airbnb/import.ts');hook.deregister();
const row=()=>({listing_id:'/hotel/mt/example.html',name:'Example apartment',unit_name:'Two-Bedroom Apartment',url:'https://www.booking.com/hotel/mt/example.en-gb.html',locality:'Sliema',address:'Sliema, Malta',property_type:'apartment',bedrooms:2,adults:4,units:1,checkin:'2026-10-27',checkout:'2026-10-30',total_cents:45000,taxes_included:true,additional_charges_text:'Refundable deposit EUR 100.',rate_conditions:'Non-refundable; no meals.',observed_at:new Date().toISOString()});
test('Booking preserves rate details, canonical identity and EUR per-night conversion',()=>{
 const q=normalizeRows([row()],'booking')[0];assert.equal(q.listingId,'/hotel/mt/example.html');assert.equal(q.totalCents/100/q.nights,150);assert.equal(q.provider,'booking');assert.equal(q.sourceDetails.additional_charges_text,'Refundable deposit EUR 100.');assert.equal(q.reviewReason,'');
 for(const patch of [{url:'https://booking.com.evil.example/hotel/mt/example.html'},{listing_id:'/hotel/mt/different.html'},{units:2},{total_cents:0},{checkout:'2026-10-27'},{taxes_included:'yes'}])assert.throws(()=>normalizeRows([{...row(),...patch}],'booking'));
});
test('unusual prices, conflicting addresses and ambiguous units are flagged, not silently corrected',()=>{
 for(const patch of [{total_cents:930100},{address:'FNT 1113 Victoria, Malta',locality:'Rabat (Gozo)'},{address:'10 Zondadari, RBT 1173 Mdina',locality:'Mdina'},{unit_name:'Single Room (entire apartment)'}])assert.ok(normalizeRows([{...row(),...patch}],'booking')[0].reviewReason);
});
test('multi-source snapshot keeps provider identities distinct and excludes flagged prices',()=>{
 const db=new DatabaseSync(':memory:');for(const file of ['0003_chilly_queen_noir.sql','0004_booking_observations.sql'])db.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const insert=db.prepare('INSERT INTO airbnb_observations (id,listing_id,name,url,locality,property_type,bedrooms,adults,checkin,checkout,nights,total_cents,observed_at,imported_by,provider,review_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const [id,provider,reason,price] of [['1','airbnb','',30000],['2','booking','',45000],['3','booking','review',930100]])insert.run(id,'same','name','https://example.test','Sliema','apartment',2,4,'2026-10-27','2026-10-30',3,price,'2026-10-13','owner',provider,reason);
 const query=listingQuery({locality:'Sliema',bedrooms:2,propertyType:'apartment',adults:4,month:'2026-10'});const rows=db.prepare(query.sql).all(...query.args);assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.provider)),new Set(['booking','airbnb']));db.close();
});
