import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createRuntime,identityHeaders} from './runtime.mjs';
import {JobQueue} from './jobs.mjs';
import {createAccountStore,accountHeaders,createStripeClient} from './accounts.mjs';
import {handleBilling,registerPage} from './billing.mjs';
const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD,token=process.env.MARKET_COLLECTOR_TOKEN;
if(!email||!password||password.length<16||!token||token.length<32)throw Error('Run the Docker setup script first. Credentials are missing or too short.');
const dataDir=process.env.DATA_DIR||'/data';fs.mkdirSync(dataDir,{recursive:true});
const mf=await createRuntime({dataDir,adminEmail:email});
const accounts=createAccountStore(dataDir);
const stripeKey=process.env.STRIPE_SECRET_KEY||'';
const stripeWebhookSecret=process.env.STRIPE_WEBHOOK_SECRET||'';
const stripe=createStripeClient(stripeKey);
const priceIds={individual:process.env.STRIPE_INDIVIDUAL_PRICE_ID||'',portfolio:process.env.STRIPE_PORTFOLIO_PRICE_ID||''};
const stripeReady=Boolean(stripe&&stripeWebhookSecret&&priceIds.individual&&priceIds.portfolio);
const idHeaders=identityHeaders(email);
const queue=new JobQueue(path.join(dataDir,'jobs.sqlite'),{
 collect:async q=>{const r=await fetch((process.env.COLLECTOR_URL||'http://collector:8080')+'/collect',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(q),signal:AbortSignal.timeout(150000)});const data=await r.json();if(!r.ok)throw Error(data.errors?.join(' ')||data.error||`Collector error ${r.status}`);return data;},
 save:async captures=>{const r=await mf.dispatchFetch('http://ownly.internal/api/admin/airbnb',{method:'POST',headers:{...idHeaders,'Content-Type':'application/json'},body:JSON.stringify({action:'import',captures})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save prices');return d;}
});
const interval=setInterval(()=>queue.tick().catch(e=>console.error('Scheduler:',e.message)),2000);
function auth(header){const a=Buffer.from(header||''),b=Buffer.from('Basic '+Buffer.from(`${email}:${password}`).toString('base64'));return a.length===b.length&&timingSafeEqual(a,b);}
const sessionKey=createHash('sha256').update(password+'\0'+token).digest();
const sessionLifetime=7*24*60*60*1000;
function equal(a,b){const left=Buffer.from(a||''),right=Buffer.from(b||'');return left.length===right.length&&timingSafeEqual(left,right);}
function safePath(value){try{const url=new URL(value||'/', 'https://ownly.local');return url.origin==='https://ownly.local'&&value?.startsWith('/')&&!value.startsWith('//')&&!url.pathname.startsWith('/login')?url.pathname+url.search+url.hash:'/';}catch{return '/';}}
function sessionCookie(value,origin){return `ownly_session=${value}; HttpOnly; SameSite=Lax; Path=/; ${origin.startsWith('https://')?'Secure; ':''}Max-Age=${value?sessionLifetime/1000:0}`;}
function signedSession(subject='owner'){const expiry=String(Date.now()+sessionLifetime),payload=`${expiry}.${subject}`;return `${payload}.${createHmac('sha256',sessionKey).update(payload).digest('hex')}`;}
function getSession(header){const value=(header||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('ownly_session='))?.slice(14),match=/^(\d{13})\.([a-zA-Z0-9-]+)\.([a-f0-9]{64})$/.exec(value||'');if(!match||Number(match[1])<Date.now()||Number(match[1])>Date.now()+sessionLifetime)return null;const payload=`${match[1]}.${match[2]}`;if(!equal(match[3],createHmac('sha256',sessionKey).update(payload).digest('hex')))return null;if(match[2]==='owner')return {userId:'docker-owner',email,name:'Ownly Owner',owner:true};const account=accounts.byId(match[2]);return account&&['active','trialing'].includes(account.status)?account:null;}
function loginPage(next,error=false){const destination=safePath(next).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Ownly</title><style>*,*:before,*:after{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:#f2f6f3;color:#142c25;font:16px system-ui,sans-serif}.card{width:min(100%,400px);background:white;border:1px solid #dce8df;border-radius:22px;padding:36px;box-shadow:0 25px 65px #1b493019}.brand{font-size:30px;font-weight:800;letter-spacing:-1.5px;color:#176c4a}h1{font-size:25px;margin:25px 0 8px}p{color:#52685d;line-height:1.5}label{display:block;margin:20px 0 6px;font-size:14px;font-weight:700}input{width:100%;padding:13px;border:1px solid #bccfc2;border-radius:10px;font:inherit}button{width:100%;margin-top:25px;padding:14px;border:0;border-radius:10px;background:#166b49;color:white;font:inherit;font-weight:700;cursor:pointer}.error{color:#a12c2c;background:#fff1f1;padding:10px;border-radius:8px}</style></head><body><main class="card"><div class="brand">Ownly Malta</div><h1>Sign in to Ownly Malta</h1><p>Enter the email and password you used when you subscribed.</p>${error?'<p class="error" role="alert">Email or password incorrect. Please try again.</p>':''}<form method="post" action="/login"><input type="hidden" name="next" value="${destination}"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button></form><p><a href="/register">Start a 7-day free trial</a></p><p><a href="/">Back to Ownly Malta</a></p></main></body></html>`;}
const publicAssets=new Set(fs.readdirSync('dist/client',{recursive:true}).filter(file=>fs.statSync(path.join('dist/client',file)).isFile()).map(file=>'/'+file.split(path.sep).join('/')));
const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 if(req.url==='/health')return json(200,{ok:true});
 const origin=process.env.PUBLIC_ORIGIN||'http://localhost:3000';
 const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/register'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"});return res.end(registerPage(url.searchParams.get('plan')==='portfolio'?'portfolio':'individual',stripeReady));}
 if(req.method==='GET'&&url.pathname==='/login'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"});return res.end(loginPage(url.searchParams.get('next')));}
 if(req.method==='POST'&&url.pathname==='/login'){
  if(req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'Invalid origin'});
  let input='';for await(const chunk of req){input+=chunk;if(input.length>4096)return json(413,{error:'Login request too large'});}
  const form=new URLSearchParams(input),next=safePath(form.get('next'));
  const loginEmail=form.get('email')?.trim().toLowerCase(),loginPassword=form.get('password')||'',account=accounts.byEmail(loginEmail);
  if((equal(loginEmail,email.toLowerCase())&&equal(loginPassword,password))||(account&&['active','trialing'].includes(account.status)&&accounts.verify(account,loginPassword))){res.writeHead(303,{'Location':next,'Set-Cookie':sessionCookie(signedSession(account?.id||'owner'),origin),'Cache-Control':'no-store'});return res.end();}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(loginPage(next,true));
 }
 if(req.method==='GET'&&url.pathname==='/signout-with-chatgpt'){res.writeHead(303,{'Location':'/login','Set-Cookie':sessionCookie('',origin),'Cache-Control':'no-store'});return res.end();}
 const basicAuthenticated=auth(req.headers.authorization),session=getSession(req.headers.cookie),authenticated=basicAuthenticated||!!session;
 if(await handleBilling(req,res,url,{origin,stripe,stripeReady,webhookSecret:stripeWebhookSecret,priceIds,accounts,getSession,signedSession,sessionCookie,json}))return;
 const publicRequest=['GET','HEAD'].includes(req.method)&&(['/','/terms','/privacy','/register','/billing/success','/billing/cancel'].includes(url.pathname)||publicAssets.has(url.pathname));
 if(!authenticated&&!publicRequest){
  if(req.method==='GET'&&!url.pathname.startsWith('/api/')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"});return res.end(loginPage(req.url));}
  return json(401,{error:'Sign in required'});
 }
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'Invalid origin'});
 let body; if(!['GET','HEAD'].includes(req.method)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2000000)return json(413,{error:'Maximum request size is 2 MB'});chunks.push(chunk);}body=Buffer.concat(chunks);}
 if(url.pathname==='/api/admin/airbnb-jobs'){
 if(req.method==='GET')return json(200,queue.list());
 if(req.method==='POST'){const value=JSON.parse(body.toString());if(value.action==='create')return json(201,{id:queue.add(value)});queue.update(value.id,value.action);return json(200,{ok:true});}return json(405,{error:'Method not allowed'});
 }
 if(url.pathname==='/signin-with-chatgpt'||url.pathname==='/signout-with-chatgpt'){const target=url.searchParams.get('return_to');res.writeHead(302,{Location:target?.startsWith('/')&&!target.startsWith('//')?target:'/admin/airbnb'});return res.end();}
 const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v&&!k.startsWith('oai-')&&!['host','authorization','connection','content-length','origin','x-ownly-plan'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
 if(authenticated){const identity=basicAuthenticated?idHeaders:session?.owner?idHeaders:session?accountHeaders(session):idHeaders;for(const [k,v] of Object.entries(identity))headers.set(k,v);}
 const response=await mf.dispatchFetch(url.href,{method:req.method,headers,body});res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e.message);json(400,{error:e.message});}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Ownly ready. Automatic search queue is running.'));
async function stop(){clearInterval(interval);server.close();while(queue.busy)await new Promise(r=>setTimeout(r,100));queue.close();await mf.dispose();process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
