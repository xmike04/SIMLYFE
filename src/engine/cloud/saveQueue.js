import { getErrorClass } from '../diagnostics';

/**
 * @typedef {object} SaveReceipt
 * @property {'saved'|'failed'|'skipped'} status
 * @property {string} operationId
 * @property {string|null} errorClass
 */

/**
 * Orders writes to each destination within one mounted account hook.
 * Captured callbacks own their destinations and payloads. A failed write is
 * reported once and never prevents a later write; pending writes are not retried.
 */
export function createSaveQueue() {
  const tails = new Map();

  return {
    /** @returns {Promise<SaveReceipt>} */
    enqueue(destinationKey, { operationId, write }) {
      const execute = async () => {
        try {
          await write();
          return { status: 'saved', operationId, errorClass: null };
        } catch (error) {
          return { status: 'failed', operationId, errorClass: getErrorClass(error) };
        }
      };
      const previous = tails.get(destinationKey);
      // Start an idle destination immediately; queued writes wait for acknowledgement.
      const writing = previous ? previous.then(execute, execute) : execute();
      const tail = writing.then(() => {
        if (tails.get(destinationKey) === tail) tails.delete(destinationKey);
      });
      tails.set(destinationKey, tail);
      return writing;
    },
  };
}
