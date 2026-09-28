export const demo = {name:'My freedom plan',age:28,retire:45,horizon:90,expenses:50000,leanExpenses:30000,fatExpenses:75000,baristaIncome:20000,baristaUntil:55,income:100000,assets:800000,contribution:30000,inflation:6,preReturn:12,postReturn:8,stepUp:5,pension:0,pensionAge:60,withdrawalTax:0,volatility:12,goals:[{name:'Home down payment',amount:2000000,age:33}],incomes:[]};
export const assetClasses=['Equity','Debt','Cash','Gold','Property','Other'],regions=['India','US','Europe','Other'];
// Size-weighted return across holdings, or null without any invested amount.
export function blendedReturn(p){const t=(p.holdings||[]).reduce((s,h)=>s+h.amount,0);return t>0?p.holdings.reduce((s,h)=>s+h.amount*h.ret,0)/t:null;}
export function validate(p) {
  if(p.holdings===undefined) p.holdings=[];
  if(!Array.isArray(p.holdings)||p.holdings.length>40) throw Error('A plan can contain up to 40 holdings.');
  for(const h of p.holdings) if(typeof h.name!=='string'||!assetClasses.includes(h.cls)||!regions.includes(h.region)||!Number.isFinite(h.ret)||h.ret<-10||h.ret>25||!Number.isFinite(h.amount)||h.amount<0||h.amount>1e12) throw Error('Check each holding’s class, region, return and amount.');
  // With holdings, retirement investments are always their total.
  if(p.holdings.length) p.assets=p.holdings.reduce((s,h)=>s+h.amount,0);
  const ranges={age:[18,99],retire:[18,100],horizon:[19,110],expenses:[1,1e9],income:[0,1e9],assets:[0,1e12],contribution:[0,1e9],inflation:[0,20],preReturn:[-10,25],postReturn:[-10,20],stepUp:[0,20],pension:[0,1e9],pensionAge:[18,110]};
  for(const [k,[min,max]] of Object.entries(ranges)) if(!Number.isFinite(p[k])||p[k]<min||p[k]>max) throw Error(`Please check ${k.replace(/([A-Z])/g,' $1').toLowerCase()}.`);
  if(['age','retire','horizon','pensionAge'].some(k=>!Number.isInteger(p[k]))) throw Error('Use whole ages.');
  if(p.leanExpenses===undefined) p.leanExpenses=Math.round(p.expenses*0.6);
  if(!Number.isFinite(p.leanExpenses)||p.leanExpenses<1||p.leanExpenses>p.expenses) throw Error('Lean monthly spending must be between 1 and your monthly spending.');
  if(p.fatExpenses===undefined) p.fatExpenses=Math.round(p.expenses*1.5);
  if(!Number.isFinite(p.fatExpenses)||p.fatExpenses<p.expenses||p.fatExpenses>1e9) throw Error('Fat monthly spending must be at least your monthly spending.');
  if(p.baristaIncome===undefined) p.baristaIncome=Math.round(p.expenses*0.4);
  if(p.baristaUntil===undefined) p.baristaUntil=60;
  if(!Number.isFinite(p.baristaIncome)||p.baristaIncome<0||p.baristaIncome>1e9) throw Error('Please check part-time income.');
  if(!Number.isInteger(p.baristaUntil)||p.baristaUntil<18||p.baristaUntil>110) throw Error('Part-time work must end at a whole age between 18 and 110.');
  if(p.withdrawalTax===undefined) p.withdrawalTax=0;
  if(!Number.isFinite(p.withdrawalTax)||p.withdrawalTax<0||p.withdrawalTax>50) throw Error('Tax on withdrawals must be between 0% and 50%.');
  if(p.volatility===undefined) p.volatility=12;
  if(!Number.isFinite(p.volatility)||p.volatility<0||p.volatility>40) throw Error('Return volatility must be between 0% and 40%.');
  if(p.retire<p.age||p.horizon<=p.retire) throw Error('Retirement age must be at least your current age and before the planning horizon.');
  if(!Array.isArray(p.goals)||p.goals.length>30) throw Error('A plan can contain up to 30 goals.');
  for(const g of p.goals) {
    if(!Number.isFinite(g.amount)||g.amount<=0||g.amount>1e12||!Number.isInteger(g.age)||g.age<p.age||g.age>=p.horizon||typeof g.name!=='string') throw Error('Check each goal’s amount and age.');
    if(g.kind!==undefined&&g.kind!=='out'&&g.kind!=='in') throw Error('Check each goal’s type.');
    if(g.inflation!==undefined&&(!Number.isFinite(g.inflation)||g.inflation<0||g.inflation>30)) throw Error('Goal inflation must be between 0% and 30%.');
    const f=g.fund;
    if(f!==undefined&&(typeof f!=='object'||typeof f.separate!=='boolean'||!Number.isFinite(f.saved)||f.saved<0||f.saved>1e12||!Number.isFinite(f.ret)||f.ret<-10||f.ret>25||!Number.isFinite(f.monthly)||f.monthly<0||f.monthly>1e9)) throw Error('Check the goal’s savings, return and monthly contribution.');
  }
  if(p.incomes===undefined) p.incomes=[];
  if(!Array.isArray(p.incomes)||p.incomes.length>20) throw Error('A plan can contain up to 20 income streams.');
  for(const s of p.incomes) if(typeof s.name!=='string'||!Number.isFinite(s.monthly)||s.monthly<=0||s.monthly>1e9||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<18||s.end>111||s.end<=s.start||typeof s.inflate!=='boolean') throw Error('Check each income stream’s amount and ages.');
  return p;
}
// Yearly retirement spending at age a, in future money. Pension, income streams and (in a
// Barista FIRE scenario) part-time work reduce it; fixed streams do not rise with inflation.
function spendingAt(p,a) {
  const factor=(1+p.inflation/100)**(a-p.age);
  let linked=(a>=p.pensionAge?p.pension:0)+(p.baristaActive&&a<p.baristaUntil?p.baristaIncome:0),fixed=0;
  for(const s of p.incomes) if(a>=s.start&&a<s.end) {if(s.inflate) linked+=s.monthly;else fixed+=s.monthly;}
  return Math.max(0,(p.expenses-linked)*12*factor-fixed*12);
}
// Each goal grows at its own inflation rate (the plan rate unless set). Inflows count negative.
export const goalCost=(p,g,a=g.age)=>g.amount*(1+(g.inflation??p.inflation)/100)**(a-p.age);
// A goal paid from its own savings is planned separately and never touches the retirement portfolio.
const separate=g=>g.kind!=='in'&&g.fund?.separate===true;
// Tax on withdrawals is the share of each withdrawal lost to tax, so covering a cost needs cost/(1−tax).
// It applies to everything the portfolio pays out; money coming in is entered after tax.
const grossUp=p=>1/(1-p.withdrawalTax/100);
const goalsAt=(p,a)=>p.goals.reduce((s,g)=>g.age===a&&!separate(g)?s+(g.kind==='in'?-goalCost(p,g):goalCost(p,g)*grossUp(p)):s,0);
const drawAt=(p,a)=>spendingAt(p,a)*grossUp(p);
// Stand-alone funding plan for one goal: earmarked savings compound at the goal's return, and
// monthly amounts are invested at the start of each month (annuity-due at the equivalent monthly rate).
export function goalPlan(p,g) {
  const f={separate:separate(g),saved:g.fund?.saved??0,ret:g.fund?.ret??p.preReturn,monthly:g.fund?.monthly??0};
  const years=Math.max(0,g.age-p.age),months=years*12,i=(1+f.ret/100)**(1/12)-1,grow=(1+f.ret/100)**years;
  const annuity=months===0?0:Math.abs(i)<1e-12?months:((1+i)**months-1)/i*(1+i);
  const target=goalCost(p,g),fvSaved=f.saved*grow,gap=Math.max(0,target-fvSaved),projected=fvSaved+f.monthly*annuity;
  return {...f,years,target,targetToday:g.amount,fvSaved,gap,projected,
    monthlyNeeded:months?gap/annuity:null,
    shortfall:Math.max(0,target-projected),surplus:Math.max(0,projected-target),
    funded:target>0?Math.min(1,fvSaved/target):1,fundedWithPlan:target>0?Math.min(1,projected/target):1,
    routes:(months?[1,.75,.5,.25,0]:[1]).map(share=>({share,lump:gap*share/grow,monthly:months?gap*(1-share)/annuity:null}))};
}
// Annual beginning-of-year cash flows; effective annual nominal returns.
// Expenses and income are entered in today's money.
export function requiredCorpus(p, retirement=p.retire) {
  const r=1+p.postReturn/100;
  let need=0;
  for(let a=p.horizon-1;a>=retirement;a--) {
    // Money arriving later cannot cover earlier years, so the requirement never goes negative.
    need=Math.max(0,need/r+drawAt(p,a)+goalsAt(p,a));
  }
  return need;
}
// What moved the balance during year a (future money): investing or spending, each goal, and withdrawal tax.
export function yearFlows(p,a,retirement=p.retire) {
  const invest=a<retirement?p.contribution*12*(1+p.stepUp/100)**(a-p.age):0,spend=a<retirement?0:spendingAt(p,a);
  const items=p.goals.filter(g=>g.age===a&&!separate(g)).map(g=>({name:g.name,kind:g.kind==='in'?'in':'out',amount:goalCost(p,g)}));
  const outs=spend+items.reduce((s,x)=>s+(x.kind==='out'?x.amount:0),0);
  return {invest,spend,items,tax:outs*(grossUp(p)-1)};
}
// rates, when given, overrides the yearly return (%) for each year from today — used by stress tests.
export function simulate(p, retirement=p.retire, contribution=p.contribution, stopAt=retirement, rates=null) {
  let balance=p.assets, firstShortfall=null, retirementAssets=retirement===p.age?balance:null;
  const points=[{age:p.age,balance}];
  for(let a=p.age;a<p.horizon;a++) {
    const goals=goalsAt(p,a);
    if(a<retirement) balance+=(a<stopAt?contribution*12:0)*(1+p.stepUp/100)**(a-p.age)-goals;
    else balance-=drawAt(p,a)+goals;
    if(balance < -0.01 && firstShortfall===null) firstShortfall=a;
    balance=Math.max(0,balance)*(1+(rates?rates[a-p.age]:a<retirement?p.preReturn:p.postReturn)/100);
    if(a+1===retirement) retirementAssets=balance;
    points.push({age:a+1,balance});
  }
  return {points,firstShortfall,retirementAssets,final:balance};
}
export function calculate(p) {
  validate(p);
  const target=requiredCorpus(p), todayTarget=target/(1+p.inflation/100)**(p.retire-p.age);
  const projection=simulate(p);
  let forecast=null;
  for(let a=p.age;a<p.horizon;a++) if(simulate(p,a).firstShortfall===null) {forecast=a;break;}
  let lo=0,hi=Math.max(1,p.contribution);
  if(p.retire>p.age) {
    while(simulate(p,p.retire,hi).firstShortfall!==null&&hi<1e10) hi*=2;
    for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(simulate(p,p.retire,mid).firstShortfall===null) hi=mid;else lo=mid;}
  }
  return {target,todayTarget,projection,forecast,requiredMonthly:p.retire===p.age?null:hi,progress:todayTarget>0?p.assets/todayTarget*100:100,gap:Math.max(0,target-projection.retirementAssets),surplus:p.income-p.expenses,savingsRate:p.income>0?(p.income-p.expenses)/p.income*100:null};
}
function scenario(p,changes){
  const r=calculate({...p,...changes});
  return {target:r.target,todayTarget:r.todayTarget,forecast:r.forecast,requiredMonthly:r.requiredMonthly};
}
// Lean FIRE: the same plan funded at a frugal spending floor.
export function lean(p) {validate(p);return {...scenario(p,{expenses:p.leanExpenses}),expenses:p.leanExpenses};}
// Fat FIRE: the same plan funded at a more generous spending level.
export function fat(p) {validate(p);return {...scenario(p,{expenses:p.fatExpenses}),expenses:p.fatExpenses};}
// Barista FIRE: part-time income covers some spending from retirement until baristaUntil.
export function barista(p) {validate(p);return {...scenario(p,{baristaActive:true}),income:p.baristaIncome,until:p.baristaUntil};}
// Coast FIRE: invested enough that growth alone (no further contributions) funds retirement at the target age.
export function coast(p) {
  validate(p);
  if(p.retire===p.age) return null;
  const funded=assets=>simulate({...p,assets},p.retire,0).firstShortfall===null;
  let lo=0,hi=Math.max(1,p.assets);
  while(!funded(hi)&&hi<1e15) hi*=2;
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(funded(mid)) hi=mid;else lo=mid;}
  let age=null,balance=null;
  for(let c=p.age;c<=p.retire;c++){const s=simulate(p,p.retire,p.contribution,c);if(s.firstShortfall===null){age=c;balance=s.points[c-p.age].balance;break;}}
  return {todayNumber:hi,reached:funded(p.assets),progress:Math.min(100,p.assets/hi*100),age,balance};
}
// ---- Stress testing ----
// Seeded generator so the same plan always gives the same simulated futures.
function mulberry(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function normals(n,paths,seed){const r=mulberry(seed),z=[];for(let k=0;k<paths;k++){const row=new Float64Array(n);for(let i=0;i<n;i++){let u=0;while(!u)u=r();row[i]=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r());}z.push(row);}return z;}
// Each year's return is the plan's assumed return plus volatility × a standard normal draw, floored at −90%.
const pathRates=(p,z)=>Array.from(z,(v,i)=>Math.max(-90,(p.age+i<p.retire?p.preReturn:p.postReturn)+p.volatility*v));
const pct=(sorted,q)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.round(q*(sorted.length-1))))];
export function stressTest(p,{paths=1000,seed=1,confidence=0.9}={}) {
  validate(p);
  const n=p.horizon-p.age,z=normals(n,paths,seed),successRate=q=>z.reduce((s,row)=>s+(simulate(q,q.retire,q.contribution,q.retire,pathRates(q,row)).firstShortfall===null),0)/paths;
  const runs=z.map(row=>simulate(p,p.retire,p.contribution,p.retire,pathRates(p,row)));
  const bands=[];for(let i=0;i<=n;i++){const col=runs.map(r=>r.points[i].balance).sort((a,b)=>a-b);bands.push({age:p.age+i,p10:pct(col,.1),p25:pct(col,.25),p50:pct(col,.5),p75:pct(col,.75),p90:pct(col,.9)});}
  const fails=runs.map(r=>r.firstShortfall).filter(a=>a!==null).sort((a,b)=>a-b);
  // Monthly spending (today's money) that still succeeds in `confidence` of the same futures.
  let lo=0,hi=p.expenses*4;if(successRate({...p,expenses:hi,leanExpenses:Math.min(p.leanExpenses,hi),fatExpenses:Math.max(p.fatExpenses,hi)})>=confidence) lo=hi;
  else for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(successRate({...p,expenses:mid,leanExpenses:Math.min(p.leanExpenses,mid),fatExpenses:Math.max(p.fatExpenses,mid)})>=confidence) lo=mid;else hi=mid;}
  // Sequence risk: the same 25% fall in the first year of retirement versus fifteen years later.
  const crash=at=>{const rates=Array.from({length:n},(_,i)=>p.age+i<p.retire?p.preReturn:p.postReturn);if(at-p.age<n)rates[at-p.age]=-25;return simulate(p,p.retire,p.contribution,p.retire,rates);};
  const base=simulate(p),early=crash(p.retire),late=crash(Math.min(p.horizon-1,p.retire+15));
  return {paths,successRate:(paths-fails.length)/paths,bands,failAges:fails,medianFailAge:fails.length?pct(fails,.5):null,earliestFail10:fails.length>=paths*.1?pct(runs.map(r=>r.firstShortfall??Infinity).sort((a,b)=>a-b),.1):null,safeExpenses:lo,confidence,
    sequence:{base:{shortfall:base.firstShortfall,final:base.final},early:{age:p.retire,shortfall:early.firstShortfall,final:early.final},late:{age:Math.min(p.horizon-1,p.retire+15),shortfall:late.firstShortfall,final:late.final}}};
}
export function convertPlan(p,rate){if(!Number.isFinite(rate)||rate<=0)throw Error('Invalid exchange rate.');const next=structuredClone(p);for(const k of ['expenses','leanExpenses','fatExpenses','baristaIncome','income','assets','contribution','pension'])if(next[k]!==undefined)next[k]*=rate;next.goals=next.goals.map(g=>({...g,amount:g.amount*rate,...(g.fund?{fund:{...g.fund,saved:g.fund.saved*rate,monthly:g.fund.monthly*rate}}:{})}));next.incomes=(next.incomes||[]).map(s=>({...s,monthly:s.monthly*rate}));next.holdings=(next.holdings||[]).map(h=>({...h,amount:h.amount*rate}));return next;}
export function countdown(target,now=new Date()){
  const end=new Date(target+'T00:00:00');if(!Number.isFinite(end.getTime()))return null;
  if(end<=now)return {years:0,months:0,days:0,past:true};
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let months=(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth();
  const advance=n=>new Date(start.getFullYear(),start.getMonth()+n,Math.min(start.getDate(),new Date(start.getFullYear(),start.getMonth()+n+1,0).getDate()));
  if(advance(months)>end)months--;
  return {years:Math.floor(months/12),months:months%12,days:Math.round((end-advance(months))/86400000),past:false};
}
