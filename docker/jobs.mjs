import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {validateQuery} from '../lib/airbnb/normalize.ts';
const DAY=86400000;
export class JobQueue{
 constructor(file,{collect,save,now=()=>Date.now()}){
 this.db=new DatabaseSync(file);this.collect=collect;this.save=save;this.now=now;this.busy=false;
 this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS searches(id TEXT PRIMARY KEY, query TEXT NOT NULL, interval_days INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, next_run INTEGER NOT NULL, created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, search_id TEXT NOT NULL, status TEXT NOT NULL, query TEXT NOT NULL, started INTEGER, finished INTEGER, inserted INTEGER, error TEXT, attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0);`);
 // A terminated browser process must never leave a permanently running job.
 this.db.prepare("UPDATE runs SET status='queued',error='Resuming after service restart' WHERE status='running'").run();
 }
 list(){return {available:true,searches:this.db.prepare('SELECT * FROM searches ORDER BY created DESC LIMIT 100').all().map(r=>({...r,query:JSON.parse(r.query)})),runs:this.db.prepare('SELECT * FROM runs ORDER BY rowid DESC LIMIT 100').all().map(r=>({...r,query:JSON.parse(r.query)}))};}
 add(input){const q=validateQuery(input.query);if(q.checkin<new Date(this.now()).toISOString().slice(0,10))throw Error('Use current or future dates.');const interval=Number(input.intervalDays??0);if(![0,3,7].includes(interval))throw Error('Choose once, every 3 days or weekly.');if(this.db.prepare('SELECT COUNT(*) AS n FROM searches WHERE enabled=1').get().n>=30)throw Error('Maximum 30 active searches. Pause an existing search first.');
 const id=randomUUID();this.db.prepare('INSERT INTO searches(id,query,interval_days,next_run,created) VALUES(?,?,?,?,?)').run(id,JSON.stringify(q),interval,this.now(),this.now());this.enqueue(id,q);this.db.prepare('UPDATE searches SET next_run=?,enabled=? WHERE id=?').run(this.now()+interval*DAY,interval?1:0,id);return id;}
 enqueue(id,q){if(this.db.prepare("SELECT id FROM runs WHERE search_id=? AND status IN ('queued','running')").get(id))return;this.db.prepare("INSERT INTO runs(id,search_id,status,query) VALUES(?,?,'queued',?)").run(randomUUID(),id,JSON.stringify(q));}
 update(id,action){const s=this.db.prepare('SELECT * FROM searches WHERE id=?').get(id);if(!s)throw Error('Search not found.');if(action==='pause'){this.db.prepare('UPDATE searches SET enabled=0 WHERE id=?').run(id);this.db.prepare("UPDATE runs SET status='cancelled',finished=? WHERE search_id=? AND status='queued'").run(this.now(),id);}
 else if(action==='resume'){if(!s.interval_days)throw Error('One-time searches cannot be resumed. Use Run now.');this.db.prepare('UPDATE searches SET enabled=1,next_run=? WHERE id=?').run(this.now(),id);}
 else if(action==='run'){const q=JSON.parse(s.query);if(s.interval_days){const days=Math.floor((this.now()-s.created)/DAY);q.checkin=new Date(Date.parse(q.checkin)+days*DAY).toISOString().slice(0,10);q.checkout=new Date(Date.parse(q.checkout)+days*DAY).toISOString().slice(0,10);}if(q.checkin<new Date(this.now()).toISOString().slice(0,10))throw Error('These dates have passed. Create a new search.');this.enqueue(id,q);}else throw Error('Unknown action.');}
 async tick(){if(this.busy)return;this.busy=true;try{
 const now=this.now();for(const s of this.db.prepare('SELECT * FROM searches WHERE enabled=1 AND next_run<=?').all(now)){
 const original=JSON.parse(s.query);const days=Math.floor((now-s.created)/DAY);const q={...original,checkin:new Date(Date.parse(original.checkin)+days*DAY).toISOString().slice(0,10),checkout:new Date(Date.parse(original.checkout)+days*DAY).toISOString().slice(0,10)};
 this.enqueue(s.id,q);this.db.prepare('UPDATE searches SET next_run=? WHERE id=?').run(now+s.interval_days*DAY,s.id);
 }
 const job=this.db.prepare("SELECT * FROM runs WHERE status='queued' AND retry_at<=? ORDER BY rowid LIMIT 1").get(now);if(!job)return;
 this.db.prepare("UPDATE runs SET status='running',started=?,attempts=attempts+1 WHERE id=?").run(now,job.id);
 try{const q=JSON.parse(job.query);const result=await this.collect(q);if(!result?.captures?.length)throw Error(result?.errors?.join(' ')||'No usable capture returned.');
 for(const c of result.captures){if(c.query?.checkin!==q.checkin||c.query?.checkout!==q.checkout||c.query?.adults!==q.adults||c.query?.bedrooms!==q.bedrooms)throw Error('Collector returned different search parameters.');}
 const saved=await this.save(result.captures);const partial=result.errors?.length>0;
 this.db.prepare('UPDATE runs SET status=?,finished=?,inserted=?,error=? WHERE id=?').run(partial?'partial':'completed',this.now(),saved.inserted,partial?result.errors.join(' ').slice(0,1000):null,job.id);
 }catch(e){const attempts=job.attempts+1;const blocked=/verification|captcha|access restriction|access denied|403/i.test(String(e.message));const retry=attempts<3&&!blocked;
 this.db.prepare('UPDATE runs SET status=?,finished=?,error=?,retry_at=? WHERE id=?').run(retry?'queued':'failed',retry?null:this.now(),String(e.message).slice(0,1000),this.now()+attempts*60000,job.id);}
 }finally{this.busy=false;}}
 close(){this.db.close();}
}
