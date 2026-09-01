# Prospect discovery pipeline

Fleet OS prospect discovery is organization-scoped and intentionally separates research from interactive browsing.

## Discovery

`POST /api/prospects/discover`

```json
{
  "location": "Ambler, PA",
  "industry": "HVAC contractors",
  "limit": 10
}
```

The server builds a fleet-oriented search query and uses Firecrawl web search. Results from social networks and directory aggregators are excluded. Existing prospect domains are deduplicated before insertion. New records are stored as `source=firecrawl_search` with the discovery query and snippet preserved as evidence metadata.

A custom `query` may be supplied when the operator wants a narrower search. Discovery never invokes Browserbase.

## Qualification

Research remains `POST /api/prospects/:id/research`. Firecrawl crawls the prospect's public website and the AI layer evaluates only the supplied website evidence. A score of 40 or higher moves a new/researching prospect to `qualified`; lower-confidence records remain `researching` rather than being falsely promoted.

Fleet-size estimates remain null when unsupported. Evidence URLs are retained on the prospect.

## Tool boundary

- Firecrawl: search, discovery, crawl, public-web research.
- Browserbase: explicit interactive browsing and future confirmed actions such as filling forms or reordering supplies.
- AgentMail: outreach and reply workflows after a prospect is qualified.
