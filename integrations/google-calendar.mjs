// Server-side draft. This module is not connected to the deployed application.
// Access tokens must be supplied by a trusted backend, never embedded in source.
const API='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const alphabet=/^[0-9a-f]{32}$/;
const formatDate=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

export async function eventId(workspaceId,noteId,cryptoImpl=globalThis.crypto){
  if(typeof workspaceId!=='string'||!workspaceId||typeof noteId!=='string'||!noteId)throw new Error('Missing stable identifiers');
  let bytes=new TextEncoder().encode(JSON.stringify([workspaceId,noteId]));
  let hash=new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes));
  return Array.from(hash.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');
}

export function eventBody(note,id,timeZone){
  if(!alphabet.test(id)||!note||typeof note.name!=='string'||!note.name.trim()||note.name.length>1000)throw new Error('Invalid note');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(note.date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(note.time||''))throw new Error('A valid date and time are required');
  if(typeof timeZone!=='string'||!timeZone)throw new Error('A valid time zone is required');
  try{new Intl.DateTimeFormat('en',{timeZone}).format(0)}catch{throw new Error('A valid time zone is required')}
  let wall=new Date(note.date+'T'+note.time+':00Z');
  if(Number.isNaN(wall.getTime())||wall.toISOString().slice(0,10)!==note.date)throw new Error('Invalid date');
  let end=new Date(wall.getTime()+30*60000);
  return {id,summary:note.name.trim(),start:{dateTime:note.date+'T'+note.time+':00',timeZone},end:{dateTime:formatDate(end)+'T'+end.toISOString().slice(11,19),timeZone},visibility:'private',reminders:{useDefault:false,overrides:[{method:'popup',minutes:15}]},extendedProperties:{private:{source:'marketing-hub',noteKey:id}}};
}

export async function syncNote({workspaceId,note,token,timeZone,fetchImpl=fetch,cryptoImpl=globalThis.crypto}){
  if(typeof token!=='string'||!token)throw new Error('Google authorization required');
  const id=await eventId(workspaceId,note?.id,cryptoImpl),body=eventBody(note,id,timeZone);
  const headers={Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'};
  const get=()=>fetchImpl(API+'/'+id,{headers});
  const update=async existing=>{
    const record=await existing.json();
    if(record.extendedProperties?.private?.source!=='marketing-hub'||record.extendedProperties?.private?.noteKey!==id)throw new Error('Event ID is already used by another event');
    if(!record.etag)throw new Error('Cannot safely update without event version');
    const response=await fetchImpl(API+'/'+id,{method:'PATCH',headers:{...headers,'If-Match':record.etag},body:JSON.stringify(body)});
    if(response.status===412)throw new Error('Calendar event changed; review before retrying');
    if(!response.ok)throw new Error('Calendar update failed ('+response.status+')');
    return {status:'updated',id};
  };
  let existing=await get();
  if(existing.ok)return update(existing);
  if(existing.status!==404)throw new Error('Calendar lookup failed ('+existing.status+')');
  let created=await fetchImpl(API,{method:'POST',headers,body:JSON.stringify(body)});
  if(created.status===409){existing=await get();if(existing.ok)return update(existing)}
  if(!created.ok)throw new Error('Calendar creation failed ('+created.status+')');
  return {status:'created',id};
}
