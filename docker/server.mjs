import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {createRuntime,identityHeaders} from './runtime.mjs';
import {JobQueue} from './jobs.mjs';
const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD,token=process.env.MARKET_COLLECTOR_TOKEN;
if(!email||!password||password.length<16||!token||token.length<32)throw Error('Run the Docker setup script first. Credentials are missing or too short.');
const dataDir=process.env.DATA_DIR||'/data';fs.mkdirSync(dataDir,{recursive:true});
const mf=await createRuntime({dataDir,adminEmail:email});
const idHeaders=identityHeaders(email);
const queue=new JobQueue(path.join(dataDir,'jobs.sqlite'),{
 collect:async q=>{const r=await fetch((process.env.COLLECTOR_URL||'http://collector:8080')+'/collect',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(q),signal:AbortSignal.timeout(150000)});const data=await r.json();if(!r.ok)throw Error(data.errors?.join(' ')||data.error||`Collector error ${r.status}`);return data;},
 save:async captures=>{const r=await mf.dispatchFetch('http://ownly.internal/api/admin/airbnb',{method:'POST',headers:{...idHeaders,'Content-Type':'application/json'},body:JSON.stringify({action:'import',captures})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save prices');return d;}
});
const interval=setInterval(()=>queue.tick().catch(e=>console.error('Scheduler:',e.message)),2000);
function auth(header){const a=Buffer.from(header||''),b=Buffer.from('Basic '+Buffer.from(`${email}:${password}`).toString('base64'));return a.length===b.length&&timingSafeEqual(a,b);}
const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 if(req.url==='/health')return json(200,{ok:true});
 if(!auth(req.headers.authorization)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Ownly private prototype", charset="UTF-8"','Cache-Control':'no-store'});return res.end('Sign in with your Ownly owner credentials.');}
 const origin=process.env.PUBLIC_ORIGIN||'http://localhost:3000';
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'Invalid origin'});
 let body; if(!['GET','HEAD'].includes(req.method)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2000000)return json(413,{error:'Maximum request size is 2 MB'});chunks.push(chunk);}body=Buffer.concat(chunks);}
 const url=new URL(req.url,origin);
 if(url.pathname==='/api/admin/airbnb-jobs'){
 if(req.method==='GET')return json(200,queue.list());
 if(req.method==='POST'){const value=JSON.parse(body.toString());if(value.action==='create')return json(201,{id:queue.add(value)});queue.update(value.id,value.action);return json(200,{ok:true});}return json(405,{error:'Method not allowed'});
 }
 if(url.pathname==='/signin-with-chatgpt'||url.pathname==='/signout-with-chatgpt'){const target=url.searchParams.get('return_to');res.writeHead(302,{Location:target?.startsWith('/')&&!target.startsWith('//')?target:'/admin/airbnb'});return res.end();}
 const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v&&!k.startsWith('oai-')&&!['host','authorization','connection','content-length','origin'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
 for(const [k,v] of Object.entries(idHeaders))headers.set(k,v);
 const response=await mf.dispatchFetch(url.href,{method:req.method,headers,body});res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e.message);json(400,{error:e.message});}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Ownly ready. Automatic search queue is running.'));
async function stop(){clearInterval(interval);server.close();while(queue.busy)await new Promise(r=>setTimeout(r,100));queue.close();await mf.dispose();process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
