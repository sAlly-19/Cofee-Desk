import type {SessionHistoryEntry} from './session';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function matchesDevice(device:{name:string;remoteId:string},query:string){const q=normalize(query);if(!q)return true;if(normalize(device.name).includes(q))return true;const digits=q.replace(/[\s-]/g,'');return /^\d+$/.test(digits)&&device.remoteId.replace(/\D/g,'').includes(digits);}
export function filterHistory(entries:SessionHistoryEntry[],query:string,result:string,aliases:{name:string;remoteId:string}[]=[]){const names=new Map(aliases.map(e=>[e.remoteId,e.name]));return entries.filter(e=>matchesDevice({...e,name:names.get(e.remoteId)||e.name},query)&&(result==='all'||e.result===result));}
