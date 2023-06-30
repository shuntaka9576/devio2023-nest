import {
  Injectable,
  LoggerService as NestCommonLoggerService,
} from '@nestjs/common';
import * as winston from 'winston';
import * as util from 'util';
import { asyncLocalStorage } from '../../infrastructures/async-storage';

const LOG_LEVEL = process.env.LOG_LEVEL;

@Injectable()
export class LoggerService implements NestCommonLoggerService {
  logger: winston.Logger;

  constructor() {
    const logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [new winston.transports.Console()],
      level: LOG_LEVEL ?? 'info',
    });

    this.logger = logger;
  }

  debug(message: string) {
    const store = asyncLocalStorage?.getStore();

    this.logger.log({
      level: 'debug',
      requestId: store?.requestId,
      lineId: store?.lineId,
      userId: store?.userId,
      message: message,
    });
  }

  log(message: string, params?: unknown) {
    const store = asyncLocalStorage?.getStore();

    this.logger.log({
      level: 'info',
      requestId: store?.requestId,
      lineId: store?.lineId,
      userId: store?.userId,
      message: message,
      params: params,
    });
  }

  error(message: string, error: unknown, params?: unknown) {
    const store = asyncLocalStorage?.getStore();

    this.logger.log({
      level: 'error',
      requestId: store?.requestId,
      lineId: store?.lineId,
      userId: store?.userId,
      message: message,
      error: util.inspect(error),
      params: params,
    });
  }

  warn(message: string, error: unknown) {
    const store = asyncLocalStorage?.getStore();
    this.logger.log({
      level: 'warn',
      requestId: store?.requestId,
      lineId: store?.lineId,
      userId: store?.userId,
      message: message,
      error: util.inspect(error),
    });
  }
}
