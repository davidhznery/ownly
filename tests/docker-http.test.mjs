import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('Docker gateway: owner login, background queue, real persistence and no collector exposure',{timeout:20000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ownly-http-'));
 const captures=[1,2,3,4,5].map(n=>JSON.parse(fs.readFileSync(`lib/airbnb/airbnb-live-2026-09-18-page${n}.json`,'utf8')));
 const collector=http.createServer((req,res)=>{assert.equal(req.headers.authorization,'Bearer test-collector-secret-long-enough-123456789');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({captures}));});collector.listen(0,'127.0.0.1');await once(collector,'listening');
 const reservation=http.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const base=`http://127.0.0.1:${port}`;const auth='Basic '+Buffer.from('owner@example.test:test-owner-password-123456789').toString('base64');
 const child=spawn(process.execPath,['docker/server.mjs'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,PUBLIC_ORIGIN:base,ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'test-owner-password-123456789',MARKET_COLLECTOR_TOKEN:'test-collector-secret-long-enough-123456789',COLLECTOR_URL:`http://127.0.0.1:${collector.address().port}`},stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',x=>output+=x);
 try{await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error(output);})]);
 const signIn=await fetch(base+'/admin/airbnb');assert.equal(signIn.status,200);const signInHtml=await signIn.text();assert.match(signInHtml,/Sign in to Ownly/);assert.equal(signIn.headers.get('www-authenticate'),null);
 const csrf=signInHtml.match(/name="csrf" value="([^"]+)"/)[1],formCookie=signIn.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/api/admin/airbnb-jobs',{headers:{'oai-authenticated-user-email':'owner@example.test'}})).status,401);
 const login=await fetch(base+'/login',{method:'POST',headers:{Origin:base,Cookie:formCookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,email:'owner@example.test',password:'test-owner-password-123456789',next:'/admin/airbnb'}),redirect:'manual'});
 assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/admin/airbnb');assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
 const cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/admin/airbnb',{headers:{Cookie:cookie}})).status,200);
 const headers={Authorization:auth,'Content-Type':'application/json',Origin:base};
 const page=await fetch(base+'/admin/airbnb',{headers});assert.equal(page.status,200);const html=await page.text();assert.match(html,/Define your comparison/);
 const asset=html.match(/href="([^" ]+\.css)"/)[1];assert.equal((await fetch(base+asset,{headers})).status,200);
 assert.equal((await fetch(base+'/api/admin/airbnb-jobs',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
 const created=await fetch(base+'/api/admin/airbnb-jobs',{method:'POST',headers,body:JSON.stringify({action:'create',query:{area:"St. Paul's Bay",...captures[0].query,pages:5},intervalDays:0})});assert.equal(created.status,201);
 let run;for(let i=0;i<20;i++){const data=await (await fetch(base+'/api/admin/airbnb-jobs',{headers})).json();run=data.runs[0];if(run.status==='completed')break;await new Promise(r=>setTimeout(r,250));}
 assert.equal(run.status,'completed',JSON.stringify(run));assert.equal(run.inserted,50);
 const params=new URLSearchParams({area:"St. Paul's Bay",checkin:'2026-09-25',checkout:'2026-09-27',adults:'4',bedrooms:'2'});
 const data=await (await fetch(base+'/api/admin/airbnb?'+params,{headers})).json();assert.equal(data.rows.length,31);
 }finally{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}await new Promise(r=>collector.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
