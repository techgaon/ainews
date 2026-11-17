// Add only AI News rules to the current live ruleset, preserving other apps.
import {createSign} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function mergeRules(source,fragment){
  const start='    // AI_NEWS_BEGIN',end='    // AI_NEWS_END';
  const a=source.indexOf(start),b=source.indexOf(end);
  if(a>=0){if(b<a)throw Error('Incomplete AI News rules marker; refusing to replace live rules.');return source.slice(0,a)+fragment.trimEnd()+source.slice(b+end.length);}
  const tail=source.match(/\n\s*}\s*\n}\s*$/);
  if(!tail||!source.includes('match /databases/{database}/documents'))throw Error('Unrecognized live rules structure; refusing to overwrite it.');
  return source.slice(0,tail.index)+'\n'+fragment.trimEnd()+source.slice(tail.index);
}
async function main(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT;if(!raw)throw Error('FIREBASE_SERVICE_ACCOUNT is not configured in this repository. Firebase activation is pending; existing news publishing is unchanged.');
  let sa;try{sa=JSON.parse(raw);}catch{throw Error('The configured service account is not valid JSON.');}const project='petpyaar-a3ea6';if(sa.project_id!==project)throw Error('Service account belongs to a different project.');
  const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000),part=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const jwt=part+'.'+createSign('RSA-SHA256').update(part).sign(sa.private_key).toString('base64url');
  const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(20000)});if(!tr.ok)throw Error('Firebase service-account authentication failed.');const token=(await tr.json()).access_token;
  async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...opt.headers},signal:AbortSignal.timeout(30000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error('Firebase setup failed: HTTP '+r.status+' '+(data.error?.message||''));return data;}
  const rules='https://firebaserules.googleapis.com/v1/',releaseName=`projects/${project}/releases/cloud.firestore`,release=await api(rules+releaseName),old=await api(rules+release.rulesetName);
  const fragment=fs.readFileSync(new URL('./ainews.rules.fragment',import.meta.url),'utf8'),files=old.source.files.map(f=>({name:f.name,content:f.content})),file=files.find(f=>f.name==='firestore.rules')||files.find(f=>f.content.includes('service cloud.firestore'));
  if(!file)throw Error('Cannot locate the live Firestore rules file.');const original=file.content;file.content=mergeRules(original,fragment);
  if(file.content!==original){const created=await api(rules+`projects/${project}/rulesets`,{method:'POST',body:JSON.stringify({source:{files}})});const current=await api(rules+releaseName);if(current.rulesetName!==release.rulesetName)throw Error('Live rules changed during setup. Retry instead of overwriting another update.');await api(rules+releaseName,{method:'PATCH',body:JSON.stringify({release:{name:releaseName,rulesetName:created.name},updateMask:'rulesetName'})});console.log('AI News rules added; previous rules for other apps preserved.');}
  // Probe the exact public control read before enabling the publishing guard.
  let verified=false;for(let i=0;i<8;i++){const probe=await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/ainConfig/publishing`,{signal:AbortSignal.timeout(20000)});if(probe.ok||probe.status===404){verified=true;break;}await new Promise(r=>setTimeout(r,2000));}if(!verified)throw Error('Control read probe failed; readiness has not been enabled.');
  fs.writeFileSync(new URL('../data/firebase-ready.json',import.meta.url),JSON.stringify({enabled:true,activatedAt:new Date().toISOString()})+'\n');
  console.log('Firebase permissions verified. AI News account statistics and publishing control are ready.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
