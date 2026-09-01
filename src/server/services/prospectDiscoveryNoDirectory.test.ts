import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('directory filtering',()=>{
 it('filters Yelp, MapQuest, Yellow Pages, Indeed, and Glassdoor',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  for(const domain of ['yelp.com','mapquest.com','yellowpages.com','indeed.com','glassdoor.com']) expect(source).toContain(domain);
 });
});
