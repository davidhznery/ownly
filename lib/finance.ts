export type SavedExpense = { id:string; label:string; amount:number; frequency:'monthly'|'quarterly'|'annual'|'one-time' };
export type IncludedServices={electricity:boolean;water:boolean;internet:boolean;buildingFees:boolean};
export type PropertyInput = { id?:string; managementType?:'owner'|'sublet'; leaseRent?:number; name:string; location:string; strategy:'long-term'|'short-term'; propertyType:string; bedrooms:number; servicesIncluded:IncludedServices; purchasePrice:number; currentValue:number; monthlyRent:number; nightlyRate:number; occupancy:number; nightsAvailable:number; otherIncome:number; operatingExpenses:number; mortgagePayment:number; loanBalance:number; expenseBreakdown?:SavedExpense[]; };

export function calculateProperty(input:PropertyInput) {
  const monthlyRevenue=input.strategy==='short-term'?input.nightlyRate*input.nightsAvailable*(input.occupancy/100)+input.otherIncome:input.monthlyRent+input.otherIncome;
  const housingCost=input.managementType==='sublet'?(input.leaseRent??0):input.mortgagePayment;
  const monthlyCashFlow=monthlyRevenue-input.operatingExpenses-housingCost;
  const annualCashFlow=monthlyCashFlow*12;
  return {monthlyRevenue,monthlyCashFlow,annualCashFlow,annualExpenses:(input.operatingExpenses+housingCost)*12,profitMargin:monthlyRevenue?(monthlyCashFlow/monthlyRevenue)*100:0,cashOnCash:input.managementType==='sublet'||input.purchasePrice<=input.loanBalance?null:(annualCashFlow/(input.purchasePrice-input.loanBalance))*100,equity:input.managementType==='sublet'?0:input.currentValue-input.loanBalance};
}

export function projectProperty(input:PropertyInput,years:number,appreciation=3,rentGrowth=2.5,expenseInflation=2) {
  if(input.managementType==='sublet'){const revenue=calculateProperty(input).monthlyRevenue*12*Math.pow(1+rentGrowth/100,years);const expenses=(input.operatingExpenses+(input.leaseRent??0))*12*Math.pow(1+expenseInflation/100,years);return {years,value:0,equity:0,annualCashFlow:revenue-expenses};}
  const current=calculateProperty(input); const value=input.currentValue*Math.pow(1+appreciation/100,years); const revenue=current.monthlyRevenue*12*Math.pow(1+rentGrowth/100,years); const expenses=input.operatingExpenses*12*Math.pow(1+expenseInflation/100,years); const balance=Math.max(0,input.loanBalance-input.mortgagePayment*12*years*.55);
  return {years,value,equity:value-balance,annualCashFlow:revenue-expenses-input.mortgagePayment*12};
}

export const euro=(value:number,compact=false)=>new Intl.NumberFormat('en-MT',{style:'currency',currency:'EUR',maximumFractionDigits:0,notation:compact?'compact':'standard'}).format(value);
