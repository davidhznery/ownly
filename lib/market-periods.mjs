const DAY=86400000;
const iso=date=>date.toISOString().slice(0,10);

export function fortnight(date) {
  const value=new Date(date+'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value.getTime())||iso(value)!==date) throw Error('Invalid date');
  const year=value.getUTCFullYear(),month=value.getUTCMonth(),second=value.getUTCDate()>15;
  return {start:iso(new Date(Date.UTC(year,month,second?16:1))),end:iso(new Date(Date.UTC(year,month,second?new Date(Date.UTC(year,month+1,0)).getUTCDate():15)))};
}

export function rangePeriods(start,end) {
  const first=fortnight(start),last=fortnight(end);
  if(start>end||Date.parse(end)-Date.parse(start)>366*DAY) throw Error('Choose a date range of up to one year');
  return {start:first.start,end:last.end};
}

export function upcomingPeriods(now,count=2) {
  const today=iso(new Date(now));let period=fortnight(today);const result=[];
  for(let i=0;result.length<count&&i<count+2;i++) {
    // A representative three-night stay, not the price for every day in the bucket.
    const checkin=iso(new Date(Math.max(Date.parse(period.start)+3*DAY,Date.parse(today)+DAY)));
    const checkout=iso(new Date(Date.parse(checkin)+3*DAY));
    if(Date.parse(checkout)<=Date.parse(period.end)+DAY)result.push({...period,checkin,checkout});
    period=fortnight(iso(new Date(Date.parse(period.end)+DAY)));
  }
  return result;
}
