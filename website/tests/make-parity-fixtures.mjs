// Writes ios/Tests/Fixtures/engine-parity.json: plans plus the website engine's results for them.
// The iOS parity test runs the Swift engine on the same plans and must match.
// Run from website/: node tests/make-parity-fixtures.mjs
import {writeFileSync, mkdirSync} from 'node:fs';
import {demo, validate, calculate, lean, fat, barista, coast, goalPlan, blendedReturn, yearFlows, stressTest, requiredCorpus, convertPlan, previewLifeEvent, planChanges, readiness, legacyAt} from '../dist/engine.js';

const base = {name:'Fixture',age:32,retire:50,horizon:95,expenses:75000,income:180000,assets:4500000,contribution:70000,inflation:5,preReturn:8,postReturn:6,stepUp:3,pension:0,pensionAge:60,goals:[]};
const plans = {
  sample: structuredClone(demo),
  legacyFields: structuredClone(base),
  wellFunded: {...structuredClone(base), contribution:150000, name:'Well funded'},
  everything: {...structuredClone(base), name:'Everything', pension:15000, withdrawalTax:15, volatility:18,
    goals:[{name:'School',amount:2500000,age:45,inflation:10},{name:'Bonus',amount:1000000,age:38,kind:'in',inflation:0},
      {name:'House',amount:8000000,age:42,fund:{separate:true,saved:300000,ret:9,monthly:30000}},{name:'Travel',amount:500000,age:60}],
    incomes:[{name:'Rent',monthly:20000,start:50,end:96,inflate:true},{name:'Annuity',monthly:10000,start:65,end:80,inflate:false}],
    holdings:[{name:'Stocks',cls:'Equity',region:'India',ret:13,amount:4000000},{name:'PF',cls:'Debt',region:'India',ret:7.5,amount:500000},{name:'401k',cls:'Equity',region:'US',ret:10,amount:1200000}]},
  retireNow: {...structuredClone(base), name:'Retire now', age:60, retire:60, horizon:90, assets:30000000, contribution:0},
  usd: convertPlan({...structuredClone(base), name:'Dollars'}, 0.012),
  lifePurchase: {...structuredClone(base), name:'Car at 36', lifeEvents:[{type:'purchase',name:'Car',start:36,amount:1500000}]},
  lifeWork: {...structuredClone(base), name:'Career break', withdrawalTax:10,
    lifeEvents:[{type:'work',name:'Sabbatical',start:38,end:40,percent:0,draw:40000},{type:'work',name:'Part-time',start:44,end:50,percent:50,draw:0},{type:'purchase',name:'Travel',start:39,amount:600000}]},
  allPaused: {...structuredClone(base), name:'Paused', assets:0, lifeEvents:[{type:'work',name:'Pause',start:32,end:50,percent:0,draw:0}]},
  legacyAndAnswers: {...structuredClone(base), name:'Legacy', legacy:20000000, goals:[{name:'Car',amount:1500000,age:47}],
    readiness:{emergencyMonths:9,highInterestDebt:false,bridgeCovered:true,healthCover:false}},
  lifeStages: {...structuredClone(base), name:'Life stages', pension:10000, withdrawalTax:10,
    spendingChanges:[{name:'Home loan EMI',kind:'amount',monthly:30000,start:32,end:57,inflation:0},{name:'Children leave home',kind:'amount',monthly:-15000,start:58},
      {name:'Healthcare',kind:'amount',monthly:8000,start:60,inflation:12},{name:'Slower years',kind:'percent',percent:-20,start:75,end:85},{name:'Care',kind:'percent',percent:15,start:85}]},
};

const pick = r => ({target:r.target, todayTarget:r.todayTarget, forecast:r.forecast, requiredMonthly:r.requiredMonthly, progress:r.progress,
  gap:r.gap, surplus:r.surplus, savingsRate:r.savingsRate, firstShortfall:r.projection.firstShortfall, retirementAssets:r.projection.retirementAssets,
  final:r.projection.final, balances:r.projection.points.map(x=>x.balance)});
const scen = s => ({target:s.target, todayTarget:s.todayTarget, forecast:s.forecast, requiredMonthly:s.requiredMonthly});

const cases = Object.entries(plans).map(([key, input]) => {
  const p = structuredClone(input); validate(p);
  const c = coast(p), st = stressTest(p, {paths:200, seed:7, confidence:0.9});
  return {key, input, expected:{
    assets:p.assets, calculate:pick(calculate(p)), requiredCorpus:requiredCorpus(p),
    lean:scen(lean(p)), fat:scen(fat(p)), barista:scen(barista(p)),
    coast:c && {todayNumber:c.todayNumber, reached:c.reached, progress:c.progress, age:c.age, balance:c.balance},
    goalPlans:p.goals.map(g => { const x = goalPlan(p, g); return {target:x.target, fvSaved:x.fvSaved, gap:x.gap, projected:x.projected,
      monthlyNeeded:x.monthlyNeeded, shortfall:x.shortfall, routes:x.routes.map(r => ({lump:r.lump, monthly:r.monthly}))}; }),
    blendedReturn:blendedReturn(p), legacyAt:legacyAt(p),
    readiness:readiness(p).map(i=>({id:i.id,status:i.status,value:i.value})),
    yearFlows:[p.age, p.retire, Math.min(p.horizon-1, p.retire+10)].map(a => { const f = yearFlows(p, a); return {age:a, invest:f.invest, spend:f.spend, tax:f.tax, items:f.items.map(i => i.amount)}; }),
    stress:{successRate:st.successRate, safeExpenses:st.safeExpenses, medianFailAge:st.medianFailAge, earliestFail10:st.earliestFail10,
      p10:st.bands.map(b=>b.p10), p50:st.bands.map(b=>b.p50), p90:st.bands.map(b=>b.p90), sequence:st.sequence}}};
});

const previews = [
  {key:'addCar', input:structuredClone(plans.legacyFields), event:{type:'purchase',name:'Car',start:40,amount:2000000}},
  {key:'addBreak', input:structuredClone(plans.lifePurchase), event:{type:'work',name:'Break',start:45,end:47,percent:25,draw:30000}},
].map(c => { const r = previewLifeEvent(structuredClone(c.input), c.event);
  return {...c, expected:{beforeTarget:r.before.target, afterTarget:r.after.target, beforeForecast:r.before.forecast, afterForecast:r.after.forecast,
    beforeRequired:r.before.requiredMonthly, afterRequired:r.after.requiredMonthly, afterFinal:r.after.projection.final}}; });

const changePairs = [
  {key:'numbersAndGoal', before:structuredClone(base), after:{...structuredClone(base), retire:48, expenses:80000, name:'Renamed', goals:[{name:'Home',amount:2000000,age:40}]}},
  {key:'spendingChangesOnly', before:structuredClone(base), after:{...structuredClone(base), spendingChanges:[{name:'Loan',kind:'amount',monthly:20000,start:35,end:45}]}},
  {key:'lifeEventsOnly', before:structuredClone(plans.lifePurchase), after:{...structuredClone(plans.lifePurchase), lifeEvents:[]}},
  {key:'noChange', before:structuredClone(base), after:structuredClone(base)},
].map(c => ({...c, expected:planChanges(validate(structuredClone(c.before)), validate(structuredClone(c.after))).map(x => ({key:x.key, before:x.before, after:x.after}))}));

const invalid = [
  {key:'retireAfterHorizon', input:{...structuredClone(base), retire:96}},
  {key:'leanAboveSpending', input:{...structuredClone(base), leanExpenses:80000}},
  {key:'badHolding', input:{...structuredClone(base), holdings:[{name:'x',cls:'Crypto',region:'India',ret:5,amount:1}]}},
  {key:'taxTooHigh', input:{...structuredClone(base), withdrawalTax:60}},
  {key:'overlappingWork', input:{...structuredClone(base), lifeEvents:[{type:'work',name:'A',start:35,end:38,percent:0,draw:0},{type:'work',name:'B',start:37,end:40,percent:0,draw:0}]}},
  {key:'adjacentWorkOK', input:{...structuredClone(base), lifeEvents:[{type:'work',name:'A',start:35,end:38,percent:0,draw:0},{type:'work',name:'B',start:38,end:40,percent:0,draw:0}]}},
  {key:'purchaseAfterHorizon', input:{...structuredClone(base), lifeEvents:[{type:'purchase',name:'Late',start:95,amount:1}]}},
  {key:'badLegacy', input:{...structuredClone(base), legacy:-5}},
  {key:'badEmergency', input:{...structuredClone(base), readiness:{emergencyMonths:500}}},
  {key:'badSpendingPercent', input:{...structuredClone(base), spendingChanges:[{name:'X',kind:'percent',percent:-95,start:60}]}},
  {key:'badSpendingAges', input:{...structuredClone(base), spendingChanges:[{name:'X',kind:'amount',monthly:1000,start:60,end:60}]}},
  {key:'badSpendingInflation', input:{...structuredClone(base), spendingChanges:[{name:'X',kind:'amount',monthly:1000,start:60,inflation:40}]}},
  {key:'badWorkPercent', input:{...structuredClone(base), lifeEvents:[{type:'work',name:'X',start:35,end:36,percent:150,draw:0}]}},
].map(c => { try { validate(structuredClone(c.input)); return {...c, error:null}; } catch (e) { return {...c, error:e.message}; } });

const out = new URL('../../ios/Tests/Fixtures/engine-parity.json', import.meta.url);
mkdirSync(new URL('.', out), {recursive:true});
writeFileSync(out, JSON.stringify({generatedFrom:'website/dist/engine.js', cases, previews, changePairs, invalid}, null, 1));
console.log(`wrote ${cases.length} plans, ${previews.length} previews, ${changePairs.length} change pairs and ${invalid.length} validation inputs`);
