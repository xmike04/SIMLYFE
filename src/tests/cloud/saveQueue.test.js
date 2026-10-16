import { describe, it, expect, vi } from 'vitest';
import { createSaveQueue } from '../../engine/cloud/saveQueue';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

describe('ordered save receipts', () => {
  it('waits for acknowledgement and orders writes and replacement per destination', async () => {
    const queue = createSaveQueue();
    const pending = deferred();
    const order = [];
    const a = queue.enqueue('user-a', { operationId: 'a', write: async () => { order.push('a'); await pending.promise; } });
    const b = queue.enqueue('user-a', { operationId: 'b', write: async () => { order.push('b'); } });
    const c = queue.enqueue('user-b', { operationId: 'c', write: async () => { order.push('c'); } });
    await c;
    expect(order).toEqual(['a', 'c']);
    pending.resolve();
    expect(await a).toEqual({ status: 'saved', operationId: 'a', errorClass: null });
    await b;
    expect(order).toEqual(['a', 'c', 'b']);
  });
  it('returns a sanitized failure without retrying or blocking the next save', async () => {
    const queue = createSaveQueue();
    const write = vi.fn().mockRejectedValue({ code: 'permission-denied', message: 'private credential' });
    const a = queue.enqueue('user', { operationId: 'a', write });
    const b = queue.enqueue('user', { operationId: 'b', write: async () => {} });
    expect(await a).toMatchObject({ status: 'failed', operationId: 'a' });
    expect(JSON.stringify(await a)).not.toContain('private');
    expect((await b).status).toBe('saved');
    expect(write).toHaveBeenCalledTimes(1);
  });
});
