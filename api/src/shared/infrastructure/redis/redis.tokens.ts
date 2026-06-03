/** DI tokens for the Redis layer. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_CLIENT_FACTORY = Symbol('REDIS_CLIENT_FACTORY');

import type Redis from 'ioredis';

/** Creates a fresh Redis connection (used for Socket.IO pub/sub pairs). */
export type RedisClientFactory = () => Redis;
