import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {calculateProperty,projectProperty} from '../lib/finance.ts';
import {canonicalLocality} from '../lib/localities.ts';
const db=new DatabaseSync(':memory:');
const wrap=(sql,args=[])=>({bind:(...values)=>wrap(sql,values),first:async()=>db.prepare(sql).get(...args),all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
const d1={prepare:sql=>wrap(sql),batch:async statements=>Promise.all(statements.map(s=>s.run()))};
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process,crypto:globalThis.crypto,URL,require:name=>{if(!(name in deps))throw Error(name);return deps[name]}});return exports;}
const queries=load('../db/queries.ts',{'cloudflare:workers':{env:{DB:d1}}});
let user={userId:'first',email:'first@example.test'};
const api=load('../app/api/properties/route.ts',{'next/server':{NextResponse:Response},'@/app/chatgpt-auth':{getChatGPTUser:async()=>user},'@/db/queries':queries,'@/lib/localities':{canonicalLocality}});
const request=(body)=>new Request('http://localhost/api/properties',{method:'POST',body:JSON.stringify(body)});
test('old schema migrates, optional prices save, sublet rent survives edits, and ownership is enforced',async()=>{
 db.exec(fs.readFileSync(new URL('../drizzle/0000_kind_warstar.sql',import.meta.url),'utf8'));
 await queries.ensurePropertySchema();await queries.ensurePropertySchema();
 let response=await api.POST(request({name:'Optional values',location:'Sliema',strategy:'long-term'}));assert.equal(response.status,201);
 let rows=await (await api.GET()).json();assert.equal(rows[0].management_type,'owner');assert.equal(rows[0].current_value,0);
 response=await api.POST(request({name:'Sublet',location:'Sliema',strategy:'long-term',managementType:'sublet',leaseRent:900,monthlyRent:1600,purchasePrice:90000,mortgagePayment:400}));assert.equal(response.status,201);const {id}=await response.json();
 rows=await (await api.GET()).json();const sublet=rows.find(row=>row.id===id);assert.equal(sublet.lease_rent,900);assert.equal(sublet.purchase_price,0);assert.equal(sublet.mortgage_payment,0);
 const body={id,name:'Edited',location:'Sliema',strategy:'long-term',managementType:'sublet',leaseRent:950};assert.equal((await api.PUT(request(body))).status,200);
 user={userId:'second',email:'second@example.test'};assert.equal((await api.PUT(request(body))).status,404);assert.equal((await (await api.GET()).json()).length,0);
 user={userId:'first',email:'first@example.test'};assert.equal((await api.POST(request({...body,leaseRent:-1}))).status,400);assert.equal((await api.POST(request({...body,managementType:'invalid'}))).status,400);
 assert.equal((await api.PUT(request({...body,managementType:'owner'}))).status,200);rows=await (await api.GET()).json();assert.equal(rows.find(row=>row.id===id).lease_rent,0);
});
test('subletting deducts landlord rent once and never creates property equity',()=>{
 const input={strategy:'long-term',managementType:'sublet',monthlyRent:1600,otherIncome:0,operatingExpenses:150,leaseRent:900,mortgagePayment:400,purchasePrice:200000,currentValue:240000,loanBalance:100000};
 const result=calculateProperty(input);assert.equal(result.monthlyCashFlow,550);assert.equal(result.annualExpenses,12600);assert.equal(result.equity,0);assert.equal(result.cashOnCash,null);
 assert.deepEqual(projectProperty(input,5,3,0,0),{years:5,value:0,equity:0,annualCashFlow:6600});
 const owned=calculateProperty({...input,managementType:'owner'});assert.equal(owned.monthlyCashFlow,1050);assert.equal(owned.equity,140000);
 const short=calculateProperty({...input,strategy:'short-term',nightlyRate:100,nightsAvailable:30,occupancy:70});assert.equal(short.monthlyCashFlow,1050);
});
