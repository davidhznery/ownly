import http from 'node:http';
import {spawn} from 'node:child_process';
import {timingSafeEqual} from 'node:crypto';
import {validateQuery} from '../lib/airbnb/normalize.ts';
const token=process.env.MARKET_COLLECTOR_TOKEN;
if(!token||token.length<32)throw Error('Set MARKET_COLLECTOR_TOKEN to a random secret of at least 32 characters.');
let active=false;
function authorized(header){const received=Buffer.from(header||'');const expected=Buffer.from(`Bearer ${token}`);return received.length===expected.length&&timingSafeEqual(received,expected);}
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(req.method==='GET'&&req.url==='/health')return send(200,{ok:true,busy:active});
 if(!authorized(req.headers.authorization))return send(401,{error:'Unauthorized'});
 if(req.method!=='POST'||req.url!=='/collect')return send(404,{error:'Not found'});
 if(active)return send(409,{error:'Collector is busy. Retry when the current search completes.'});
 let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>10000)return send(413,{error:'Request too large'});}const query=validateQuery(JSON.parse(raw));
 if(query.checkin<new Date().toISOString().slice(0,10))throw Error('Past check-in date.');
 if(active)return send(409,{error:'Collector is busy.'});active=true;const child=spawn(process.execPath,['collector/collector.mjs'],{cwd:new URL('..',import.meta.url),stdio:['pipe','pipe','pipe']});let output='';let done=false;
 const timer=setTimeout(()=>child.kill('SIGKILL'),140000);
 child.stdout.on('data',data=>{output+=data;if(output.length>2000000)child.kill('SIGKILL');});child.stderr.resume();
 const finish=(status,data)=>{if(done)return;done=true;clearTimeout(timer);active=false;if(!res.destroyed)send(status,data);};
 child.on('error',()=>finish(502,{error:'Could not start browser worker'}));
 child.on('close',()=>{try{const result=JSON.parse(output);finish(result.captures?.length?200:502,result);}catch{finish(504,{error:'Collector timed out or produced no valid result'});}});
 res.on('close',()=>{if(!res.writableEnded)child.kill('SIGKILL');});child.stdin.end(JSON.stringify(query));
 }catch(e){send(400,{error:String(e.message).slice(0,300)});}
});
server.requestTimeout=150000;server.headersTimeout=15000;server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Collector listening on port '+(process.env.PORT||8080)));
