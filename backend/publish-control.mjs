import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function pausedAt(config,now=Date.now()){if(config.paused!==true)return false;if(!config.resumeAt)return true;const until=Date.parse(config.resumeAt);return !Number.isFinite(until)||until>now;}
export async function publicationAllowed({fetcher=fetch,ready,now=Date.now()}={}){
  if(ready===undefined){try{ready=JSON.parse(fs.readFileSync(new URL('../data/firebase-ready.json',import.meta.url),'utf8')).enabled===true;}catch{ready=false;}}
  if(!ready)return true;
  const url='https://firestore.googleapis.com/v1/projects/petpyaar-a3ea6/databases/(default)/documents/ainConfig/publishing';
  const r=await fetcher(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if(r.status===404)return true;
  if(!r.ok)throw Error('Publishing control unavailable: HTTP '+r.status+'; refusing to publish this batch.');
  const j=await r.json(),f=j.fields||{};
  return !pausedAt({paused:f.paused?.booleanValue===true,resumeAt:f.resumeAt?.timestampValue||null},now);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(!await publicationAllowed()){console.log('AI News publication is paused. Existing stories are unchanged.');process.exitCode=20;}}catch(e){console.error(e.message);process.exitCode=21;}}
