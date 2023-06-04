import {
  Connection,
  Channel,
  ConsumeMessage,
  connect,
  Options,
  Replies,
} from 'amqplib';
import config from 'config';
import { MILLISECONDS_IN_SECOND } from '../constants';
import { safeStringify } from './safeStringify';

const WORK_SUFFIX = 'work';
const LOBBY_SUFFIX = 'lobby';

const queueCfg: QueueBrokerOptions | undefined = config.get('queue');

interface QueueBrokerOptions {
  url?: string;
  hostname?: string;
  username?: string;
  password?: string;
  port?: string;
}

export interface QueueInfo {
  consumerTag?: string;
  channel: Channel;
  queue: Replies.AssertQueue;
  queueId: string;
  subscription?: {
    name: string;
    options: ConsumerQueueCfg;
    isPaused: boolean;
    isDelayed: boolean;
  };
}

export type HandlerFactory = (
  queueInfo: QueueInfo
) => (msg: ConsumeMessage | null) => void;

export interface ConsumerQueueCfg {
  handlerFactory: HandlerFactory;
  maxConcurrency?: number;
}

export interface DelayedQueueCfg {
  ttl: number;
}

const defaultOptions = { url: 'amqp://localhost' };

let resolver: () => void;

function scheduleCheck(
  healthCheckFunc: (() => Promise<number>) | undefined,
  interval: number | undefined
) {
  const timeoutId = setTimeout(async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nextCheck = await healthCheckFunc!();
    if (nextCheck === 0) {
      clearTimeout(timeoutId);
    } else {
      scheduleCheck(healthCheckFunc, nextCheck * MILLISECONDS_IN_SECOND);
    }
  }, interval);
}

export class QueueBroker {
  connection?: Connection;

  channelsByQueueName: Record<string, QueueInfo> = Object.create(null);

  ready = new Promise((res) => {
    resolver = res as () => void;
  });

  constructor(private options: QueueBrokerOptions = defaultOptions) {}

  async connect() {
    const useUrl = !(
      this.options.username &&
      this.options.password &&
      this.options.hostname
    );
    const queueUrl = this.options.url as string;
    this.connection = await connect(
      useUrl
        ? queueUrl
        : {
            username: this.options.username,
            password: this.options.password,
            hostname: this.options.hostname,
            port: +(this.options.port || 5672),
          }
    );
    console.log('Connected to queue');
    resolver();
  }

  async pause(
    queueInfo: QueueInfo,
    {
      healthCheckFunc,
      healthCheckInterval,
    }: {
      healthCheckFunc?: () => Promise<number>;
      healthCheckInterval?: number;
    } = {
      healthCheckInterval: 5,
    }
  ) {
    const { channel, consumerTag, queueId, subscription, queue } = queueInfo;
    const isPaused = subscription?.isPaused;
    if (!isPaused && consumerTag) {
      this.channelsByQueueName[queueId].subscription!.isPaused = true;
      await channel.cancel(consumerTag);
      scheduleCheck(
        healthCheckFunc,
        healthCheckInterval! * MILLISECONDS_IN_SECOND
      );
      console.log(
        `Worker for ${queue.queue} has been paused until healtcheck is succesful. Current messages will be processed but no new messages will be received`
      );
      return true;
    }
    return false;
  }

  async resume(queueInfo: QueueInfo) {
    const { subscription } = queueInfo;
    const isPaused = subscription?.isPaused;
    if (
      !subscription ||
      (subscription && !isPaused) ||
      !(typeof subscription.options.handlerFactory === 'function')
    ) {
      return false;
    }
    const { name, options } = subscription;
    await (subscription.isDelayed
      ? this.subscribeDelayed(name, options)
      : this.subscribe(name, options));
    return true;
  }

  async ensureChannelAndQueue(
    name: string,
    options?: ConsumerQueueCfg
  ): Promise<QueueInfo> {
    await this.ready;
    if (!this.channelsByQueueName[name]) {
      const channel = await this.connection!.createChannel();
      const queue = await channel.assertQueue(name);
      if (options?.maxConcurrency) {
        channel.prefetch(options.maxConcurrency);
      }
      this.channelsByQueueName[name] = {
        channel,
        queue,
        queueId: name,
      };
    }
    return this.channelsByQueueName[name];
  }

  async ensureChannelAndDelayedQueue(name: string, options?: ConsumerQueueCfg) {
    const nameWithSuffix = `${name}--${WORK_SUFFIX}`;
    console.log({ nameWithSuffix });
    await this.ready;
    if (!this.channelsByQueueName[nameWithSuffix]) {
      const channel = await this.connection!.createChannel();
      if (options?.maxConcurrency) {
        channel.prefetch(options.maxConcurrency);
      }
      const exchangeDLX = `${name}ExDLX`;
      const routingKeyDLX = `${name}RoutingKeyDLX`;
      const queueDLX = `${name}Work`;
      await channel.assertExchange(exchangeDLX, 'direct', {
        durable: true,
      });
      const queue = (await channel.assertQueue(queueDLX, {
        exclusive: false,
      })) as Replies.AssertQueue;
      await channel.bindQueue(queue.queue, exchangeDLX, routingKeyDLX);
      this.channelsByQueueName[nameWithSuffix] = {
        channel,
        queue,
        queueId: nameWithSuffix,
      };
    }
    return this.channelsByQueueName[nameWithSuffix];
  }

  async subscribe(queueName: string, options: ConsumerQueueCfg) {
    const { handlerFactory } = options;
    const queueInfo = await this.ensureChannelAndQueue(queueName, options);
    const { channel, queue, queueId } = queueInfo;
    console.log(`Subscribing to queue ${queue.queue}`);
    const { consumerTag } = await channel.consume(
      queue.queue,
      handlerFactory(queueInfo)
    );
    this.channelsByQueueName[queueId].consumerTag = consumerTag;
    this.channelsByQueueName[queueId].subscription = {
      name: queueName,
      options,
      isPaused: false,
      isDelayed: false,
    };
  }

  async subscribeDelayed(queueName: string, options: ConsumerQueueCfg) {
    const queueInfo = await this.ensureChannelAndDelayedQueue(
      queueName,
      options
    );
    const { channel, queue, queueId } = queueInfo;
    const { handlerFactory } = options;
    console.log(`Subscribing to delayed queue ${queue.queue}`);
    const { consumerTag } = await channel.consume(
      queue.queue,
      handlerFactory(queueInfo)
    );
    this.channelsByQueueName[queueId].consumerTag = consumerTag;
    this.channelsByQueueName[queueId].subscription = {
      name: queueName,
      options,
      isPaused: false,
      isDelayed: true,
    };
  }

  async ensureChannelAndLobby(name: string, options?: ConsumerQueueCfg) {
    const nameWithSuffix = `${name}--${LOBBY_SUFFIX}`;
    await this.ready;
    if (!this.channelsByQueueName[nameWithSuffix]) {
      const channel = await this.connection!.createChannel();
      if (options?.maxConcurrency) {
        channel.prefetch(options.maxConcurrency);
      }
      const exchange = `${name}Exchange`;
      const queueName = `${name}-${LOBBY_SUFFIX}`;
      const exchangeDLX = `${name}ExDLX`;
      const routingKeyDLX = `${name}RoutingKeyDLX`;
      const queueDLX = `${name}-${WORK_SUFFIX}`;
      await channel.assertExchange(exchange, 'direct', {
        durable: true,
      });
      await channel.assertQueue(queueDLX, {
        exclusive: false,
      });
      const queue = (await channel?.assertQueue(queueName, {
        exclusive: false,
        deadLetterExchange: exchangeDLX,
        deadLetterRoutingKey: routingKeyDLX,
      })) as Replies.AssertQueue;
      await channel?.bindQueue(queue.queue, exchange, '');
      this.channelsByQueueName[nameWithSuffix] = {
        channel,
        queue,
        queueId: nameWithSuffix,
      };
    }
    return this.channelsByQueueName[nameWithSuffix];
  }

  async sendDelayedMessage(
    queueName: string,
    content: Record<any, any>,
    options: DelayedQueueCfg
  ) {
    const { channel, queue } = await this.ensureChannelAndLobby(queueName);
    const sendToWorkQueue = options.ttl === 0;
    const queueId = sendToWorkQueue
      ? `${queueName}-${WORK_SUFFIX}`
      : queue.queue;
    return channel.sendToQueue(queueId, Buffer.from(JSON.stringify(content)), {
      ...(options.ttl > 0 ? { expiration: options.ttl } : {}),
    });
  }

  async sendMessage(
    queueName: string,
    content: Record<any, any>,
    options?: Options.Publish
  ) {
    const { channel, queue } = await this.ensureChannelAndQueue(queueName);
    return channel.sendToQueue(
      queue.queue,
      Buffer.from(JSON.stringify(content)),
      options
    );
  }
}

console.log({ queueCfg });

export const queueBroker = queueCfg
  ? new QueueBroker(queueCfg)
  : new QueueBroker();

async function connectQueue() {
  try {
    await queueBroker.connect();
  } catch (error: any) {
    console.error(
      `Cannot connect to queue, due to error: ${safeStringify(
        error
      )}. Exiting process`
    );
    process.exit(1);
  }
}

connectQueue();
