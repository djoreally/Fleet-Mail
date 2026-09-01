import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Firecrawl prospect discovery',()=>{
 afterEach(()=>{vi.restoreAllMocks();delete process.env.FIRECRAWL_API_KEY;});
 it('normalizes web search results for discovery',async()=>{
  process.env.FIRECRAWL_API_KEY='test-key';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:{web:[{url:'https://examplefleet.com',title:'Example Fleet',description:'Commercial service company with field vehicles.'}]}}),{status:200,headers:{'content-type':'application/json'}})));
  const {searchWeb}=await import('./firecrawl.js');
  const rows=await searchWeb('commercial fleets Ambler PA',5);
  expect(rows).toEqual([{url:'https://examplefleet.com',title:'Example Fleet',description:'Commercial service company with field vehicles.'}]);
  expect(fetch).toHaveBeenCalledOnce();
 });
 it('requires a discovery query',async()=>{
  process.env.FIRECRAWL_API_KEY='test-key';
  const {searchWeb}=await import('./firecrawl.js');
  await expect(searchWeb('   ')).rejects.toThrow('Search query is required');
 });
});
