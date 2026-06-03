import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/env.schema';
import { REDIS_CLIENT, REDIS_CLIENT_FACTORY, RedisClientFactory } from './redis.tokens';

/** Builds an ioredis client. `maxRetriesPerRequest: null` is required by the adapter/subscriber. */
function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
}

/**
 * Global Redis module. Exports a shared connected client (REDIS_CLIENT) and a
 * factory (REDIS_CLIENT_FACTORY) for creating dedicated connections — the
 * Socket.IO Redis adapter needs its own pub/sub pair.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        createRedis(config.get('REDIS_URL', { infer: true })),
    },
    {
      provide: REDIS_CLIENT_FACTORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): RedisClientFactory => {
        const url = config.get('REDIS_URL', { infer: true });
        return () => createRedis(url);
      },
    },
  ],
  exports: [REDIS_CLIENT, REDIS_CLIENT_FACTORY],
})
export class RedisModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown(): Promise<void> {
    // Connections are short-lived per process; ioredis cleans up on exit.
  }
}
