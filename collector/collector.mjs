// Optional local live worker. Uses the same read-only extractor as the verified cloud-browser capture.
// Run: node collector.mjs < query.json > capture-batch.json
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const AREAS={"St. Paul's Bay":"St.-Paul’s-Bay--Malta",Sliema:'Sliema--Malta',"St. Julian's":"Saint-Julian’s--Malta",Valletta:'Valletta--Malta'};

async function main(){
  const q=JSON.parse(fs.readFileSync(0,'utf8'));
  if(!Object.hasOwn(AREAS,q.area)) throw Error('Unsupported area');
  for(const [k,min,max] of [['adults',1,16],['bedrooms',1,10],['pages',1,5]])
    if(!Number.isInteger(q[k])||q[k]<min||q[k]>max) throw Error(`Invalid ${k}`);
  for(const key of ['checkin','checkout']) if(!/^\d{4}-\d{2}-\d{2}$/.test(q[key]))throw Error('Invalid date');
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({locale:'en-US'});
  const extractor=vm.runInNewContext(fs.readFileSync(path.join(root,'extract-airbnb.js'),'utf8')+'\nextractAirbnbPage;');
  const captures=[],errors=[];
  const p=new URLSearchParams({checkin:q.checkin,checkout:q.checkout,adults:String(q.adults),min_bedrooms:String(q.bedrooms),currency:'EUR',locale:'en'});
  const url='https://www.airbnb.com/s/'+encodeURIComponent(AREAS[q.area])+'/homes?'+p;
  let previousFingerprint=null;
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    for(let i=0;i<q.pages;i++){
      await page.waitForFunction(({checkin,previous})=>{
        const body=document.body?.innerText?.slice(0,2500)||'';
        if(/verify you are human|unusual traffic|access denied|automated queries/i.test(body)) return true;
        const cards=[...document.querySelectorAll('[data-testid="card-container"]')];
        const first=cards[0]?.querySelector('a[href*="/rooms/"]')?.href;
        return cards.length>0 && first!==previous && first?.includes('check_in='+checkin) && cards.some(c=>c.querySelector('[data-testid="price-availability-row"]')?.innerText?.includes('total'));
      },{checkin:q.checkin,previous:previousFingerprint},{timeout:25000});
      const body=await page.locator('body').innerText();
      if(/verify you are human|unusual traffic|access denied|automated queries/i.test(body.slice(0,2500)))throw Error('Site verification/access restriction: stopped; no bypass attempted');
      const necessary=page.getByRole('button',{name:'Only necessary',exact:true});
      if(await necessary.isVisible())await necessary.click();
      const capture=await page.evaluate(extractor);
      if(!capture.cards.length) throw Error('No listing cards: empty result or page layout changed');
      if(capture.query.checkin!==q.checkin||capture.query.checkout!==q.checkout||capture.query.adults!==q.adults) throw Error('Search state does not match requested stay');
      capture.requested_area=q.area;
      capture.page_index=i+1;
      captures.push(capture);
      if(i+1===q.pages)break;
      const next=page.getByRole('link',{name:'Next',exact:true});
      if(!await next.count())break;
      previousFingerprint=await page.locator('[data-testid="card-container"]').first().locator('a[href*="/rooms/"]').first().getAttribute('href');
      // Compare absolute URLs, matching DOM .href in the readiness check.
      previousFingerprint=new URL(previousFingerprint,page.url()).href;
      await page.waitForTimeout(1500);
      await next.click();
    }
  }catch(e){errors.push(String(e.message).slice(0,350));}
  finally{await browser.close();}
  process.stdout.write(JSON.stringify({captures,errors,status:errors.length?(captures.length?'partial':'failed'):'completed'}));
  if(!captures.length)process.exitCode=1;
}
main().catch(e=>{process.stdout.write(JSON.stringify({captures:[],errors:[String(e.message).slice(0,350)],status:'failed'}));process.exitCode=1;});
