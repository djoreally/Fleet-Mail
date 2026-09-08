export type OperationalListPage<T>={items:T[];nextCursor:string|null;hasMore:boolean};

export function readListParam(key:string,fallback=''){if(typeof window==='undefined')return fallback;return new URLSearchParams(window.location.search).get(key)??fallback}
export function replaceListParams(values:Record<string,string|null|undefined>){if(typeof window==='undefined')return;const url=new URL(window.location.href);for(const[key,value]of Object.entries(values)){const clean=String(value??'').trim();if(clean)url.searchParams.set(key,clean);else url.searchParams.delete(key)}window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`)}
export function mergeUniqueById<T extends{id:string}>(current:T[],incoming:T[]){const map=new Map(current.map(item=>[item.id,item]));for(const item of incoming)map.set(item.id,item);return Array.from(map.values())}
export function restoreListScroll(key:string){if(typeof window==='undefined')return;const value=sessionStorage.getItem(`fleet-list-scroll:${key}`);if(value){const y=Number(value);if(Number.isFinite(y))requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'auto'}))}}
export function rememberListScroll(key:string){if(typeof window==='undefined')return;sessionStorage.setItem(`fleet-list-scroll:${key}`,String(window.scrollY))}
