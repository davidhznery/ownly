import {rangePeriods} from './market-periods.mjs';

export function listingQuery({locality,bedrooms,propertyType,adults=4,month='',start='',end=''}) {
  let period=null;
  if(start||end){if(!start||!end)throw Error('Choose both start and end dates');period=rangePeriods(start,end);}
  const types={apartment:['apartment','condo','condominium','rental unit'],house:['house','home'],villa:['villa'],room:['room']};
  const names=types[propertyType]??types.apartment;
  const dateClause=period?'AND checkin>=? AND checkin<=?':"AND (?='' OR substr(checkin,1,7)=?)";
  const args=[locality,bedrooms,adults,...names,...(period?[period.start,period.end]:[month,month])];
  return {period,args,sql:`SELECT listing_id,name,url,provider,source_details,property_type,bedrooms,adults,checkin,checkout,nights,total_cents,observed_at FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY provider,listing_id ORDER BY observed_at DESC,id DESC) AS row_num FROM airbnb_observations WHERE review_reason='' AND locality=? AND bedrooms=? AND adults=? AND lower(property_type) IN (${names.map(()=>'?').join(',')}) ${dateClause}) WHERE row_num=1 ORDER BY observed_at DESC,total_cents ASC LIMIT 500`};
}
