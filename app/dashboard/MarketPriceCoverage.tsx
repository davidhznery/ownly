'use client';
import {useEffect,useState} from 'react';
import {LOCALITIES} from '@/lib/localities';
type Row={locality:string;listings:number;averageNightly:number;minNightly:number;maxNightly:number;lastObserved:string};
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
export default function MarketPriceCoverage({bedrooms,propertyType,month,start,end,onSelect}:{bedrooms:number;propertyType:string;month:string;start:string;end:string;onSelect:(locality:string)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');const params=new URLSearchParams({coverage:'1',bedrooms:String(bedrooms),propertyType,adults:'4'});if(start&&end){params.set('start',start);params.set('end',end);}else if(month)params.set('month',month);
 fetch('/api/market?'+params,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load market prices');if(!controller.signal.aborted)setRows(data.localities.filter((row:Row)=>LOCALITIES.includes(row.locality as typeof LOCALITIES[number])));}).catch(e=>{if(!controller.signal.aborted){setRows([]);setError(e.message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[bedrooms,propertyType,month,start,end]);
 const byArea=new Map(rows.map(row=>[row.locality,row]));
 return <section className="app-card locality-results"><span className="pro-pill">MARKET PRO DATA</span><h2>Saved prices across Malta and Gozo</h2><p>{loading?'Loading saved prices…':`${rows.length} of ${LOCALITIES.length} localities with matching prices · ${rows.reduce((sum,row)=>sum+row.listings,0)} listings.`} Select a locality to see its source listings. Uses the property type, bedrooms and period selected above; four guests.</p>
 {error&&<p role="alert">{error}</p>}
 {!loading&&!error&&<details open={rows.length>0}><summary>Prices by locality</summary><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Locality</th><th>Listings</th><th>Average / night</th><th>Range / night</th><th>Observed</th></tr></thead><tbody>{LOCALITIES.map(area=>{const row=byArea.get(area);return <tr key={area}><td><button className="ghost-button" onClick={()=>onSelect(area)}>{area}</button></td><td>{row?.listings??0}</td><td>{row?money(row.averageNightly):'No matching prices'}</td><td>{row?`${money(row.minNightly)} – ${money(row.maxNightly)}`:'—'}</td><td>{row?.lastObserved.slice(0,10)??'—'}</td></tr>;})}</tbody></table></div></details>}
 <p className="muted">Includes Airbnb and Booking JSON observations and automatic searches. Observations flagged for review are excluded. Advertised stay totals divided by nights; these prices do not establish occupancy or monthly earnings.</p></section>;
}
