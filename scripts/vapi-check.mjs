import {pathToFileURL} from 'node:url';
export async function inspectVapi(env = process.env, transport = fetch) {
 const key = env.VAPI_PRIVATE_KEY;
 if (!key) throw Error('Set a rotated VAPI_PRIVATE_KEY in the server environment first. No request was sent.');
 const read = async path => {
  const response = await transport('https://api.vapi.ai/' + path + '?limit=1000', {headers: {Authorization: 'Bearer ' + key}, signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('Vapi account check failed (HTTP ' + response.status + '). Check key and account access.');
  const data = await response.json();
  if (!Array.isArray(data)) throw Error('Unexpected Vapi response.');
  return data;
 };
 const [assistants, numbers] = await Promise.all([read('assistant'), read('phone-number')]);
 const assistant = assistants.find(x => x.id === env.VAPI_ASSISTANT_ID);
 const number = numbers.find(x => x.id === env.VAPI_PHONE_NUMBER_ID);
 const issues = [];
 if (!assistant) issues.push('Configured clinic assistant is missing.');
 else {
  if (!assistant.name?.startsWith('PhysioFlow')) issues.push('Selected assistant is not named for PhysioFlow; review before activation.');
  if (!(assistant.maxDurationSeconds > 0 && assistant.maxDurationSeconds <= 180)) issues.push('Assistant must have a maximum duration of 180 seconds or less.');
  if (assistant.model?.toolIds?.length || assistant.model?.tools?.length) issues.push('Assistant has tools attached; remove or review before reminder use.');
 }
 if (!number) issues.push('Configured outbound caller number is missing.');
 else if (number.provider === 'vapi' || !number.number) issues.push('Number is not verified as an imported outbound-capable phone number.');
 if (assistants.length >= 1000 || numbers.length >= 1000) issues.push('Account listing may be truncated; verify selected IDs directly.');
 return {authenticated: true, assistant: assistant ? {id: assistant.id, name: assistant.name, maxDurationSeconds: assistant.maxDurationSeconds} : null,
  caller: number ? {id: number.id, provider: number.provider, suffix: typeof number.number === 'string' ? number.number.slice(-4) : null} : null,
  availableAssistants: assistants.map(x => ({id: x.id, name: x.name})), availableNumbers: numbers.map(x => ({id: x.id, provider: x.provider, suffix: typeof x.number === 'string' ? x.number.slice(-4) : null})), issues,
  note: 'Read-only. No calls, purchases, billing changes or configuration mutations. Carrier India routing, rates, assistant behavior and consent still need verification.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try { console.log(JSON.stringify(await inspectVapi(), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
