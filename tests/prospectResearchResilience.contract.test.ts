import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const firecrawl=readFileSync('src/server/services/firecrawl.ts','utf8');
const prospecting=readFileSync('src/server/services/prospecting.ts','utf8');

describe('prospect research resilience contract',()=>{
  it('falls back from an incomplete crawl to same-domain Firecrawl search evidence',()=>{
    expect(firecrawl).toContain('fallbackWebsiteSearch');
    expect(firecrawl).toContain('same-domain search evidence');
    expect(firecrawl).toContain('site:${hostname}');
    expect(firecrawl).toContain("host===hostname||host.endsWith(`.${hostname}`)");
  });

  it('does not treat a slow crawl as an automatic research failure when search evidence exists',()=>{
    expect(firecrawl).toContain('if(fallback.length)');
    expect(firecrawl).toContain('return {sourceUrl:url.href,pages:fallback}');
    expect(firecrawl).not.toContain('The website is still being crawled. Please try again in a moment.');
  });

  it('keeps prospect qualification grounded in returned page evidence',()=>{
    expect(prospecting).toContain('const crawled=await crawlWebsite(website)');
    expect(prospecting).toContain('Use only the supplied evidence');
    expect(prospecting).toContain('Do not invent fleet size');
  });
});
