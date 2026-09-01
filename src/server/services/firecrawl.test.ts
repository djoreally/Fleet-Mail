import { describe, expect, it } from 'vitest';
import { extractWebsiteUrl, validatePublicUrl } from './firecrawl.js';

describe('Firecrawl website safeguards', () => {
  it('extracts a secure website URL from a request', () => expect(extractWebsiteUrl('Read https://example.com/docs and summarize it.')).toBe('https://example.com/docs'));
  it('ignores non-secure URLs', () => expect(extractWebsiteUrl('Read http://example.com')).toBeNull());
  it('blocks local targets before crawling', async () => await expect(validatePublicUrl('https://localhost/admin')).rejects.toThrow(/Local network/));
  it('blocks URLs with credentials', async () => await expect(validatePublicUrl('https://user:pass@example.com')).rejects.toThrow(/credentials/));
});
