import { getErrorClass } from '../diagnostics';

/** Local FIFO per destination. Never retries an ambiguous write. */
export function createSaveQueue() {
  const tails = new Map();
  return {
    enqueue(destinationKey, { operationId, write }) {
      const run = async () => {
        try {
          await write();
          return { status: 'saved', operationId, errorClass: null };
        } catch (error) {
          return { status: 'failed', operationId, errorClass: getErrorClass(error) };
        }
      };
      const prior = tails.get(destinationKey);
      const receipt = prior ? prior.then(run) : run();
      tails.set(destinationKey, receipt);
      void receipt.then(() => { if (tails.get(destinationKey) === receipt) tails.delete(destinationKey); });
      return receipt;
    },
  };
}
