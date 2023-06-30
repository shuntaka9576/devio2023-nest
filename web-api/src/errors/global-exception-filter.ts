import { ArgumentsHost, Logger, UnauthorizedException } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';

export class GraphQLUnknownError extends Error {
  message: string;

  public constructor() {
    super();
    this.message = 'unknown error';
  }
}

export class GlobalExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof UnauthorizedException) {
      throw exception;
    } else {
      this.logger.log(`GlobalException`, exception);
      const gqlHost = GqlArgumentsHost.create(host);

      if (gqlHost.getType() === 'http') {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        // response.status(400).json();
      } else {
        const ctx = gqlHost.getContext();
        const response = ctx.res;

        // response.status(400).json();
      }
    }
  }
}
