import { queueBroker } from '../utils/queueBroker';

export async function queue(name: string, data: Object) {
  try {
    await queueBroker.sendDelayedMessage(
      name,
      { data, createdAt: Date.now() },
      {
        ttl: 0,
      }
    );
  } catch (fff) {
    console.log({ fff });
  }
}
