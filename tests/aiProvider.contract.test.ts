import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('AtlasCloud provider resilience', () => {
  it('retries a rejected configured chat model with the supported fallback model', async () => {
    vi.stubEnv('ATLASCLOUD_API_KEY', 'apikey-test');
    vi.stubEnv('ATLASCLOUD_MODEL', 'legacy/model');
    vi.resetModules();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 400, msg: 'bad request' }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ model: 'deepseek-ai/deepseek-v3.2', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { callAICompletion } = await import('../src/server/services/ai.js');
    const result = await callAICompletion([{ role: 'user', content: 'hello' }]);

    expect(result.content).toBe('ok');
    expect(result.model).toBe('deepseek-ai/deepseek-v3.2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe('legacy/model');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).model).toBe('deepseek-ai/deepseek-v3.2');
  });

  it('does not mask authentication failures with a model retry', async () => {
    vi.stubEnv('ATLASCLOUD_API_KEY', 'apikey-test');
    vi.stubEnv('ATLASCLOUD_MODEL', 'legacy/model');
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const { callAICompletion } = await import('../src/server/services/ai.js');
    await expect(callAICompletion([{ role: 'user', content: 'hello' }])).rejects.toThrow('AtlasCloud API error (401)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
