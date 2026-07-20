import { describe, expect, it } from 'vitest';
import {
  InvalidRequestBodyError,
  PayloadTooLargeError,
  readBoundedText,
  readJsonBody,
} from '../../worker/http';

describe('bounded request bodies in the Workers runtime', () => {
  it('accepts a body exactly at the byte limit without Content-Length', async () => {
    const request = new Request('https://inkpoem.test/api', { method: 'POST', body: '12345678' });
    expect(await readBoundedText(request, 8)).toBe('12345678');
  });

  it('rejects an oversized declared Content-Length before reading', async () => {
    const request = new Request('https://inkpoem.test/api', {
      method: 'POST',
      headers: { 'Content-Length': '99' },
      body: 'small',
    });
    await expect(readBoundedText(request, 8)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('rejects a false small Content-Length by counting streamed bytes', async () => {
    const request = new Request('https://inkpoem.test/api', {
      method: 'POST',
      headers: { 'Content-Length': '1' },
      body: '123456789',
    });
    await expect(readBoundedText(request, 8)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('rejects invalid UTF-8 and invalid JSON', async () => {
    const invalidUtf8 = new Request('https://inkpoem.test/api', {
      method: 'POST',
      body: new Uint8Array([0xc3, 0x28]),
    });
    await expect(readBoundedText(invalidUtf8, 8)).rejects.toBeInstanceOf(InvalidRequestBodyError);

    const invalidJson = new Request('https://inkpoem.test/api', { method: 'POST', body: '{nope' });
    await expect(readJsonBody(invalidJson, 8)).rejects.toBeInstanceOf(InvalidRequestBodyError);
  });
});
