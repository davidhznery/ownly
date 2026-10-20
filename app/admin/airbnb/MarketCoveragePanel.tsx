'use client';
import {useState} from 'react';

type Cell={id:string;area:string;start:string;end:string;status:string;lastUpdated:number|null;matched:number|null;error:string|null};
export type CoverageState={settings:{enabled:boolean;scope:string;dailyBudget:number;pages:number;bedrooms:number;refreshDays:number;startedAt:number;expandAfterDays:number}|null;restricted:boolean;priorityAreas:string[];totalLocalities:number;cells:Cell[]};

export default function MarketCoveragePanel({coverage}:{coverage?:CoverageState}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!coverage)return null;
 const settings=coverage.settings,areas=new Set(coverage.cells.map(cell=>cell.area)).size;
 async function act(action:string,scope?:string){setBusy(true);setError('');try{const response=await fetch('/api/admin/airbnb-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,scope,bedrooms:2,pages:2,dailyBudget:20})});if(!response.ok)throw Error('Could not update the coverage plan');}catch(e){setError(e instanceof Error?e.message:'Could not update coverage');}finally{setBusy(false);}}
 return <section className="ab-card" aria-label="Continuous Malta market coverage"><div className="ab-heading"><div><h2>Continuous Malta coverage</h2><p>Fortnightly price samples, refreshed weekly. Two bedrooms · four guests.</p></div><span className="ab-tag">{settings?.enabled?'SCHEDULED':'PAUSED'}</span></div>
 <p className="ab-note">Start with ten priority localities, then expand to all {coverage.totalLocalities} Malta and Gozo localities after seven days. This is a starting selection, not a verified popularity ranking.</p>
 <p>{coverage.priorityAreas.join(' · ')}</p>
 <div className="ab-actions">{!settings?<button className="button" disabled={busy} onClick={()=>act('coverage-start','priority')}>Start priority coverage</button>:<><button className="outline-button" disabled={busy} onClick={()=>act(settings.enabled?'coverage-pause':'coverage-resume')}>{settings.enabled?'Pause coverage':'Resume coverage'}</button>{areas<coverage.totalLocalities&&<button className="outline-button" disabled={busy} onClick={()=>act('coverage-start','all')}>Expand to all localities now</button>}</>}</div>
 {settings&&<p className="ab-footnote">{areas} localities · current and next available fortnight · up to {settings.pages} pages/search · {settings.dailyBudget} new searches per rolling 24 hours. One search at a time, with a pause between searches. Reuse recent samples; retry empty areas after 14 days. Keep Docker running.</p>}
 {coverage.restricted&&<p role="status" className="ab-message ab-error">The source requested verification or restricted access. Automatic coverage waits 24 hours before continuing.</p>}
 {error&&<p role="alert" className="ab-message ab-error">{error}</p>}
 {coverage.cells.length>0&&<details><summary>Coverage by locality and fortnight ({coverage.cells.filter(cell=>['completed','partial','cached'].includes(cell.status)&&Number(cell.matched)>0).length} sampled / {coverage.cells.length})</summary><div className="ab-table"><table><thead><tr><th>Locality</th><th>Period</th><th>Status</th><th>Matching listings</th><th>Last update</th></tr></thead><tbody>{coverage.cells.map(cell=><tr key={cell.id}><td>{cell.area}</td><td>{cell.start} → {cell.end}</td><td>{cell.status}{cell.error&&<small>{cell.error}</small>}</td><td>{cell.matched??'—'}</td><td>{cell.lastUpdated?new Date(cell.lastUpdated).toLocaleDateString('en-GB'):'—'}</td></tr>)}</tbody></table></div></details>}
 <p className="ab-footnote">These are advertised prices for representative three-night stays. A fortnight sample does not establish an exact price for every stay in that period, or actual occupancy.</p></section>;
}
