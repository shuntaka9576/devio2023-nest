import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import {
  BadRequestException,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { GraphQLFormattedError } from 'graphql';
import { HandlerModule } from './handlers/handler.module';
import { asyncLocalStorage } from './infrastructures/async-storage';
import { LoggerService } from './utils/logger/logger-service';
import { HealthCheckController } from './handlers/controllers/health-check.controller';
import { AuthModule } from './auth/auth.module';
import { ComplexityPlugin } from './plugins/apollo-complexity-plugin';

const GRAPHQL_SCHEMA_PATH =
  process.env.GRAPHQL_SCHEMA_PATH ?? '../schema.graphql';

const DEV_STAGE_NAME = 'dev';
const STAGE_NAME = process.env.STAGE_NAME ?? DEV_STAGE_NAME;
const logger = new LoggerService();

@Module({
  controllers: [HealthCheckController],
  providers: [ComplexityPlugin],
  imports: [
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: STAGE_NAME === DEV_STAGE_NAME,
      introspection: STAGE_NAME === DEV_STAGE_NAME, // playgroundの補完が効くどうか
      typePaths: [GRAPHQL_SCHEMA_PATH],
      persistedQueries: false,
      formatError: (formattedError: GraphQLFormattedError) => {
        logger.log(`CatchException`, formattedError);

        if (
          formattedError.extensions?.code ===
          ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED
        ) {
          return new BadRequestException();
        }

        // stacktraceやpathなど不要な情報は除外
        const extensions: {
          code?: string;
          response?: object;
        } = {};

        if (
          formattedError.extensions?.code != null &&
          typeof formattedError.extensions?.code === 'string'
        ) {
          extensions.code = formattedError.extensions.code;
        }

        if (
          formattedError.extensions?.originalError != null &&
          typeof formattedError.extensions?.originalError === 'object'
        ) {
          extensions.response = formattedError.extensions.originalError;
        }

        return {
          message: formattedError.message,
          extensions: extensions,
        };
      },
    }),
    HandlerModule,
  ],
})
export class AppModule implements NestModule {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, _res: any, next: any) => {
        const requestId = req.headers['x-amzn-trace-id'];
        const store = asyncLocalStorage.getStore();

        asyncLocalStorage.run(
          {
            ...store,
            requestId,
          },
          next,
        );
      })
      .forRoutes('*');
  }
}
