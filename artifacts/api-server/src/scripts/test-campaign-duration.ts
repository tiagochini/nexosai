import assert from 'node:assert/strict';
import { resolveCampaignDays, calendarRanges, coversDays, assertDayCoverage } from '../modules/agents/campaign-duration.js';
import { getRegenIdempotencyKey, withRegenContext } from '../modules/agents/regen-context.js';
assert.equal(resolveCampaignDays({'campaign.timeline':'30_days'}, {totalDays:21}),30);
assert.equal(resolveCampaignDays({campaign:{timeline:'45_days'}}),45);
assert.equal(resolveCampaignDays({'campaign.durationDays':14}),14);
assert.equal(resolveCampaignDays({}, {totalDays:28}),28);
assert.equal(resolveCampaignDays({'campaign.timeline':'not_applicable','campaign.durationDays':0}),21);
assert.deepEqual(calendarRanges(30),[{start:1,end:7},{start:8,end:14},{start:15,end:21},{start:22,end:28},{start:29,end:30}]);
for (const n of [1,7,8,21,30,45]) {
 const rows=calendarRanges(n).flatMap(r=>Array.from({length:r.end-r.start+1},(_,i)=>({day:r.start+i})));
 assertDayCoverage(rows,1,n);
 assert.equal(rows.length,n);
}
const days=Array.from({length:30},(_,i)=>({day:i+1}));
assert.equal(coversDays(days.slice(0,21),1,30),false);
assert.equal(coversDays([...days.slice(0,29),{day:29}],1,30),false);
assert.equal(coversDays([...days,{day:31}],1,30),false);
assert.equal(coversDays(undefined,1,30),false);
assert.throws(()=>assertDayCoverage(days.slice(0,21),1,30),/incompleto/);
await withRegenContext('parent',async()=>{
 await withRegenContext('parent:days:1-7',async()=>assert.equal(getRegenIdempotencyKey(),'parent:days:1-7'));
 assert.equal(getRegenIdempotencyKey(),'parent');
});
console.log('PASS: duração canônica, blocos de 7 dias, cobertura completa e isolamento das chaves');
