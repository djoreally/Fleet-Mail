import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const contactDiscovery=readFileSync('src/server/services/prospectContactDiscovery.ts','utf8');
const routes=readFileSync('src/server/routes/prospecting.ts','utf8');
const outreach=readFileSync('src/server/services/prospectOutreach.ts','utf8');

describe('prospect contact discovery contract',()=>{
  it('uses source-grounded public web evidence and never trusts an invented email',()=>{
    expect(contactDiscovery).toContain('searchWeb(query');
    expect(contactDiscovery).toContain('site:${hostname}');
    expect(contactDiscovery).toContain('supportedSet.has(email)');
    expect(contactDiscovery).toContain('Never invent an email');
  });

  it('limits deterministic general inbox discovery to the prospect company domain',()=>{
    expect(contactDiscovery).toContain('companyDomainEmail');
    expect(contactDiscovery).toContain('domain===hostname||domain.endsWith(`.${hostname}`)');
    expect(contactDiscovery).toContain('generalAddress(supportedEmails,hostname)');
  });

  it('persists usable general email and named prospect contacts with provenance',()=>{
    expect(contactDiscovery).toContain('generalEmail');
    expect(contactDiscovery).toContain('db.update(prospects)');
    expect(contactDiscovery).toContain('db.insert(prospectContacts)');
    expect(contactDiscovery).toContain('sourceUrl');
    expect(contactDiscovery).toContain("kind:'contact_research'");
  });

  it('enriches contact data during the canonical research endpoint',()=>{
    expect(routes).toContain('prospectContactDiscoveryService.enrich');
    expect(routes).toContain('const refreshed=await prospectingService.get');
    expect(routes).toContain('contactDiscovery');
  });

  it('keeps outreach recipient selection deterministic after enrichment',()=>{
    expect(outreach).toContain('contacts.find(item=>item.isDecisionMaker&&item.email)');
    expect(outreach).toContain('contacts.find(item=>item.email)');
    expect(outreach).toContain("prospect.generalEmail||''");
    expect(outreach).toContain('A prospect or contact email is required before drafting outreach');
  });
});
