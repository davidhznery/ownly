import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {listingQuery} from '../lib/market-listings.mjs';

test('fortnight reuse excludes wrong guests and outside dates, deduplicates listings and includes condos',()=>{
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('../drizzle/0003_chilly_queen_noir.sql',import.meta.url),'utf8'));
 const insert=db.prepare('INSERT INTO airbnb_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const [id,listing,date,guests,type,observed] of [['1','a','2026-10-04',4,'Apartment','2026-10-01'],['2','a','2026-10-07',4,'Apartment','2026-10-02'],['3','b','2026-10-10',4,'Condo','2026-10-02'],['4','c','2026-10-16',4,'Apartment','2026-10-02'],['5','d','2026-10-07',2,'Apartment','2026-10-02']]){
 insert.run(id,listing,'name','https://www.airbnb.com/rooms/1','Sliema',type,2,guests,date,'2026-10-19',3,30000,observed,'owner');
 }
 db.exec(fs.readFileSync(new URL('../drizzle/0004_booking_observations.sql',import.meta.url),'utf8'));
 const run=(start,end)=>{const query=listingQuery({locality:'Sliema',bedrooms:2,propertyType:'apartment',start,end});return db.prepare(query.sql).all(...query.args);};
 const first=run('2026-10-02','2026-10-12'),overlap=run('2026-10-12','2026-10-15');assert.deepEqual(first,overlap);assert.equal(first.length,2);assert.equal(first.find(r=>r.listing_id==='a').checkin,'2026-10-07');
 assert.equal(run('2026-10-12','2026-10-18').length,3);assert.throws(()=>listingQuery({locality:'Sliema',bedrooms:2,propertyType:'apartment',start:'2026-10-02'}));db.close();
});
