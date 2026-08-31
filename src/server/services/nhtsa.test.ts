import { describe, expect, it, vi } from 'vitest';
import { decodeVin, decodeVins, isValidVin, normalizeVpicResult } from './nhtsa.js';

const VIN = '1HGCM82633A004352';

describe('NHTSA vPIC VIN decoding', () => {
  it('validates VIN length and forbidden letters', () => {
    expect(isValidVin(VIN)).toBe(true);
    expect(isValidVin('SHORT')).toBe(false);
    expect(isValidVin('1HGCM82633A00O352')).toBe(false);
  });

  it('normalizes vPIC fields', () => {
    expect(normalizeVpicResult({
      VIN,
      Make: 'HONDA',
      Model: 'Accord',
      ModelYear: '2003',
      EngineCylinders: '6',
      DisplacementL: '3.0',
      ErrorCode: '0',
      ErrorText: '0 - VIN decoded clean. Check Digit (9th position) is correct',
    })).toMatchObject({
      vin: VIN,
      make: 'HONDA',
      model: 'Accord',
      modelYear: 2003,
      engineCylinders: 6,
      engineDisplacementLiters: 3,
      valid: true,
    });
  });

  it('calls DecodeVinValues with model year', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      Results: [{ VIN, Make: 'HONDA', Model: 'Accord', ModelYear: '2003', ErrorCode: '0' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await decodeVin({ vin: VIN.toLowerCase(), modelYear: 2003 }, { fetcher: fetchMock as typeof fetch });
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(calledUrl.pathname).toContain(`/DecodeVinValues/${VIN}`);
    expect(calledUrl.searchParams.get('modelyear')).toBe('2003');
    expect(result.make).toBe('HONDA');
  });

  it('uses the batch API and preserves import metadata', async () => {
    const secondVin = '1M8GDM9AXKP042788';
    const fetcher = vi.fn(async (_url, init) => {
      expect(String(init?.body)).toContain(`DATA=${encodeURIComponent(`${VIN},2003;${secondVin},`)}`);
      return new Response(JSON.stringify({
        Results: [
          { VIN, Make: 'HONDA', ErrorCode: '0' },
          { VIN: secondVin, Make: 'MCI', ErrorCode: '0' },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const results = await decodeVins([
      { vin: VIN, modelYear: 2003, assetNumber: 'TRK-12' },
      { vin: secondVin, sourceRow: 8 },
    ], { fetcher });

    expect(results[0].input.assetNumber).toBe('TRK-12');
    expect(results[1].input.sourceRow).toBe(8);
    expect(results.map((item) => item.decoded.make)).toEqual(['HONDA', 'MCI']);
  });

  it('rejects invalid VINs before making a network request', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(decodeVin({ vin: 'bad-vin' }, { fetcher })).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
