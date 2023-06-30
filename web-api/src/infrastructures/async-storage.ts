import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage<{
  lineId?: string;
  userId?: string;
  requestId?: string;
}>();
