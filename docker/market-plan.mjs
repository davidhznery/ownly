import {validateQuery} from '../lib/airbnb/normalize.ts';
import {priorityAreas} from '../lib/airbnb/locations.mjs';
import {fileURLToPath} from 'node:url';
const areas=priorityAreas.slice(0,4);

// Preview by default. --apply registers the plan with Ownly's existing scheduler.
const apply = process.argv.includes('--apply');
const today = new Date().toISOString().slice(0,10);
const date = offset => new Date(Date.parse(today)+offset*86400000).toISOString().slice(0,10);
const plan = areas.flatMap(area => [1,2,3].flatMap(bedrooms => [14,60].map(offset => ({
  query: validateQuery({area,bedrooms,adults:Math.min(6,bedrooms*2),checkin:date(offset),checkout:date(offset+3),pages:5}),
  intervalDays:7,
}))));
if (!apply) {
  console.log(JSON.stringify({searches:plan.length,maxPagesPerCycle:plan.length*5,plan},null,2));
} else {
  process.loadEnvFile(fileURLToPath(new URL('../.env',import.meta.url)));
  const {ADMIN_EMAIL:email,ADMIN_PASSWORD:password} = process.env;
  if (!email || !password) throw Error('Missing administrator credentials in .env');
  // Credentials stay on this machine, over loopback only.
  const endpoint = 'http://127.0.0.1:3001/api/admin/airbnb-jobs';
  const headers = {Authorization:'Basic '+Buffer.from(`${email}:${password}`).toString('base64'),'Content-Type':'application/json'};
  const response = await fetch(endpoint,{headers,signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw Error(`Cannot read scheduler (HTTP ${response.status})`);
  const state = await response.json();
  const key = item => JSON.stringify([item.query.area,item.query.bedrooms,item.query.adults,item.query.pages,item.query.checkin,item.query.checkout,item.intervalDays??item.interval_days]);
  const existing = new Set(state.searches.filter(s=>s.enabled).map(key));
  const pending = plan.filter(item=>!existing.has(key(item)));
  if (state.searches.filter(s=>s.enabled).length+pending.length>30) throw Error('Plan exceeds 30 active searches. Pause existing searches first.');
  let added=0;
  for (const item of pending) {
    const result = await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action:'create',...item}),signal:AbortSignal.timeout(10000)});
    if (!result.ok) throw Error(`Stopped after ${added} additions (HTTP ${result.status}). Review saved searches before retrying.`);
    added++;
  }
  console.log(`${added} searches registered; ${plan.length-pending.length} already scheduled.`);
}
