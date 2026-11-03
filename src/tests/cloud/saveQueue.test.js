import { describe, expect, it } from 'vitest';
import { createSaveQueue } from '../../engine/cloud/saveQueue';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

describe('destination save queue', () => {
  it('starts each write once and only after the preceding destination write settles', async () => {
    const queue = createSaveQueue();
    const pending = deferred();
    const calls = [];
    const first = queue.enqueue('life-A', { operationId: 'first', write: () => { calls.push('first'); return pending.promise; } });
    const second = queue.enqueue('life-A', { operationId: 'second', write: () => { calls.push('second'); } });
    const third = queue.enqueue('life-A', { operationId: 'third', write: () => { calls.push('third'); } });
    expect(calls).toEqual(['first']);
    pending.resolve();
    expect(await Promise.all([first, second, third])).toEqual([
      { status: 'saved', operationId: 'first', errorClass: null },
      { status: 'saved', operationId: 'second', errorClass: null },
      { status: 'saved', operationId: 'third', errorClass: null },
    ]);
    expect(calls).toEqual(['first', 'second', 'third']);
  });

  it('continues after rejection without retrying the failed write', async () => {
    const queue = createSaveQueue();
    const pending = deferred();
    const calls = [];
    const first = queue.enqueue('life-A', { operationId: 'first', write: () => { calls.push('first'); return pending.promise; } });
    const second = queue.enqueue('life-A', { operationId: 'second', write: () => { calls.push('second'); } });
    expect(calls).toEqual(['first']);
    pending.reject(new TypeError('private provider detail'));
    expect(await first).toEqual({ status: 'failed', operationId: 'first', errorClass: 'TypeError' });
    expect(await second).toEqual({ status: 'saved', operationId: 'second', errorClass: null });
    expect(calls).toEqual(['first', 'second']);
  });

  it('lets another destination complete while the first is pending', async () => {
    const queue = createSaveQueue();
    const pending = deferred();
    let firstSettled = false;
    const first = queue.enqueue('life-A', { operationId: 'first', write: () => pending.promise })
      .then(receipt => { firstSettled = true; return receipt; });
    const second = queue.enqueue('life-B', { operationId: 'second', write: () => {} });
    expect(await second).toEqual({ status: 'saved', operationId: 'second', errorClass: null });
    expect(firstSettled).toBe(false);
    pending.resolve();
    await first;
  });

  it('sanitizes synchronous write errors and keeps later requests runnable', async () => {
    const queue = createSaveQueue();
    const first = queue.enqueue('life-A', {
      operationId: 'first', write: () => { throw { name: 'PrivateProviderClass', message: 'secret detail' }; },
    });
    const second = queue.enqueue('life-A', { operationId: 'second', write: () => {} });
    expect(await first).toEqual({ status: 'failed', operationId: 'first', errorClass: 'UnknownError' });
    expect(await second).toEqual({ status: 'saved', operationId: 'second', errorClass: null });
  });
});
