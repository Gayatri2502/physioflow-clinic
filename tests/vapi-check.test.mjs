import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectVapi} from '../scripts/vapi-check.mjs';
test('missing key fails before network access', async () => {
 await assert.rejects(inspectVapi({}, () => {throw Error('network must not run')}), /rotated/);
});
test('read-only checker rejects a free inbound number and unsafe assistant', async () => {
 const urls = [];
 const result = await inspectVapi({VAPI_PRIVATE_KEY:'mock', VAPI_ASSISTANT_ID:'a', VAPI_PHONE_NUMBER_ID:'p'}, async url => {
  urls.push(url);
  return Response.json(url.includes('/assistant?') ? [{id:'a',name:'Solar',maxDurationSeconds:600,model:{toolIds:['write']}}] : [{id:'p',provider:'vapi',number:'+19999999999'}]);
 });
 assert.equal(result.issues.length,4); assert.equal(urls.length,2);
 assert.equal(JSON.stringify(result).includes('mock'),false);
 assert.equal(JSON.stringify(result).includes('+19999999999'),false);
});
test('dedicated bounded assistant and imported caller pass structural checks', async () => {
 const result = await inspectVapi({VAPI_PRIVATE_KEY:'mock',VAPI_ASSISTANT_ID:'a',VAPI_PHONE_NUMBER_ID:'p'}, async url => Response.json(url.includes('/assistant?') ? [{id:'a',name:'PhysioFlow Reminders',maxDurationSeconds:180}] : [{id:'p',provider:'twilio',number:'+19999999999'}]));
 assert.deepEqual(result.issues,[]);
});
test('clinic manifest has no tools or secrets and introduces automation before appointment details', () => {
 const a = JSON.parse(readFileSync(new URL('../integrations/vapi-assistant.json',import.meta.url)));
 assert.equal(a.maxDurationSeconds,180);
 assert.equal(a.firstMessage.includes('automated'),true);
 assert.equal(a.firstMessage.includes('{{appointment'),false);
 assert.equal(a.model.tools,undefined); assert.equal(a.model.toolIds,undefined);
 assert.equal(a.server,undefined);
});
