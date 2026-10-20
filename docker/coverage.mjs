import {areas,priorityAreas} from '../lib/airbnb/locations.mjs';
import {upcomingPeriods} from '../lib/market-periods.mjs';
const DAY=86400000;

export class MarketCoverage {
  constructor(db,now){this.db=db;this.now=now;db.exec('CREATE TABLE IF NOT EXISTS market_coverage (id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL); CREATE TABLE IF NOT EXISTS market_samples (id TEXT PRIMARY KEY, refreshed INTEGER NOT NULL, matched INTEGER NOT NULL)');}
  cache(samples){for(const sample of samples)if(sample.matched>=5&&Number.isFinite(sample.refreshed))this.db.prepare('INSERT INTO market_samples VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET refreshed=excluded.refreshed,matched=excluded.matched').run(sample.id,sample.refreshed,sample.matched);}
  settings(){const row=this.db.prepare('SELECT settings FROM market_coverage WHERE id=1').get();return row?JSON.parse(row.settings):null;}
  configure(input) {
    const old=this.settings();
    if(input.action==='coverage-pause'||input.action==='coverage-resume') {
      if(!old)throw Error('Start a coverage plan first');
      old.enabled=input.action==='coverage-resume';
      this.write(old);
      if(!old.enabled)this.db.prepare("UPDATE runs SET status='cancelled',finished=? WHERE search_id LIKE 'coverage:%' AND status='queued'").run(this.now());
      return;
    }
    if(input.action!=='coverage-start')throw Error('Unknown coverage action');
    const dailyBudget=Number(input.dailyBudget??20),pages=Number(input.pages??2),bedrooms=Number(input.bedrooms??2);
    if(!Number.isInteger(dailyBudget)||dailyBudget<1||dailyBudget>30||!Number.isInteger(pages)||pages<1||pages>5||!Number.isInteger(bedrooms)||bedrooms<1||bedrooms>10)throw Error('Invalid coverage limits');
    if(input.scope&&!['priority','all'].includes(input.scope))throw Error('Invalid coverage scope');
    this.write({enabled:true,scope:input.scope??'priority',expandAfterDays:7,startedAt:old?.startedAt??this.now(),dailyBudget,pages,bedrooms,adults:4,refreshDays:7,periods:2});
  }
  write(settings){this.db.prepare('INSERT INTO market_coverage VALUES(1,?) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings').run(JSON.stringify(settings));}
  cells(settings=this.settings()) {
    if(!settings)return [];
    const expanded=settings.scope==='all'||this.now()-settings.startedAt>=settings.expandAfterDays*DAY;
    const selected=expanded?[...priorityAreas,...areas.filter(area=>!priorityAreas.includes(area))]:priorityAreas;
    return selected.flatMap(area=>upcomingPeriods(this.now(),settings.periods).map(period=>{
      const id='coverage:'+JSON.stringify([area,settings.bedrooms,settings.adults,period.start]);
      const latest=this.db.prepare('SELECT status,finished,started,matched,inserted,error FROM runs WHERE search_id=? ORDER BY rowid DESC LIMIT 1').get(id);
      const cached=this.db.prepare('SELECT * FROM market_samples WHERE id=?').get(id);
      if(cached&&this.now()-cached.refreshed<settings.refreshDays*DAY&&(!latest||cached.refreshed>(latest.finished??0)||['cancelled','missing','empty'].includes(latest.status)))return {id,area,...period,status:'cached',lastUpdated:cached.refreshed,matched:cached.matched,error:null};
      return {id,area,...period,status:latest?.status??'missing',lastUpdated:latest?.finished??null,matched:latest?.matched??null,error:latest?.error??null};
    }));
  }
  restricted(){return this.db.prepare("SELECT error FROM runs WHERE search_id LIKE 'coverage:%' AND finished>? AND status IN ('failed','partial')").all(this.now()-DAY).some(r=>/verification|captcha|access restriction|access denied|403/i.test(r.error??''));}
  list(){const settings=this.settings();return {settings,restricted:this.restricted(),priorityAreas,totalLocalities:areas.length,cells:this.cells(settings)};}
  enqueue(queue) {
    const settings=this.settings(),now=this.now();if(!settings?.enabled)return;
    const today=new Date(now).toISOString().slice(0,10);
    this.db.prepare("UPDATE runs SET status='cancelled',finished=? WHERE search_id LIKE 'coverage:%' AND status='queued' AND json_extract(query,'$.checkin')<?").run(now,today);
    for(const cell of this.cells(settings).filter(cell=>cell.status==='cached'))this.db.prepare("UPDATE runs SET status='cancelled',finished=? WHERE search_id=? AND status='queued'").run(now,cell.id);
    // Wait after access restrictions, rather than continuing through every locality.
    if(this.restricted())return;
    const used=this.db.prepare("SELECT COUNT(*) AS n FROM runs WHERE search_id LIKE 'coverage:%' AND (started>? OR (status IN ('queued','running') AND started IS NULL))").get(now-DAY).n;
    if(used>=settings.dailyBudget)return;
    const cells=this.cells(settings).filter(c=>!['queued','running'].includes(c.status)).filter(c=>{
      const ttl=c.status==='cancelled'?0:c.status==='failed'?DAY:c.status==='empty'?14*DAY:settings.refreshDays*DAY;
      return !c.lastUpdated||now-c.lastUpdated>=ttl;
    }).sort((a,b)=>(a.lastUpdated??0)-(b.lastUpdated??0));
    const cell=cells[0];if(!cell)return;
    queue.enqueue(cell.id,{area:cell.area,bedrooms:settings.bedrooms,adults:settings.adults,pages:settings.pages,checkin:cell.checkin,checkout:cell.checkout});
  }
}
