import {Miniflare} from 'miniflare';
import fs from 'node:fs';
import path from 'node:path';
export async function createRuntime({dataDir,adminEmail}){
 const common={compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'ownly-database'},d1Persist:path.join(dataDir,'d1')};
 const migrations=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(name=>({name,statements:fs.readFileSync(path.join('drizzle',name),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)}));
 // A separate bootstrap worker applies migrations before the web server opens.
 const mf=new Miniflare({...common,modules:true,script:`const migrations=${JSON.stringify(migrations)};export default {async fetch(request,env){const db=env.DB;await db.prepare('CREATE TABLE IF NOT EXISTS docker_migrations (name TEXT PRIMARY KEY)').run();for(const m of migrations){if(await db.prepare('SELECT name FROM docker_migrations WHERE name=?').bind(m.name).first())continue;await db.batch([...m.statements.map(s=>db.prepare(s)),db.prepare('INSERT INTO docker_migrations (name) VALUES (?)').bind(m.name)]);}return new Response('migrated');}}`});
 try{
 const response=await mf.dispatchFetch('http://localhost/');if(!response.ok)throw Error('Database migration failed: '+await response.text());
 const files=fs.readdirSync('dist/server',{recursive:true}).filter(f=>/\.m?js$/.test(f)).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
 await mf.setOptions({...common,modules:files.map(f=>({type:'ESModule',path:path.resolve('dist/server',f)})),bindings:{ADMIN_EMAILS:adminEmail},assets:{directory:path.resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}}});
 return mf;
 }catch(e){await mf.dispose();throw e;}
}
export function identityHeaders(email){return {'oai-authenticated-user-id':'docker-owner','oai-authenticated-user-email':email,'oai-authenticated-user-full-name':'Ownly Owner'};}
