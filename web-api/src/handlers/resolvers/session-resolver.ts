import * as zod from 'zod';
import { Logger, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { SessionConnection } from '../../graphql';
import { GetSessionUseCase } from '../../domains/get-session-use-case';
import {
  GetSessionResolverUnknownError,
  GetSessionResolverValidationError,
} from '../errors/session-resolver-error';
import { CurrentUser, GraphqlLineAuthGuard } from '../../auth/graphql.guard';
import { UserProfile } from 'src/auth/http-bearer.strategy';

const eventSchema = zod.union([
  zod.object({
    filter: zod.object({
      speakerName: zod.string(),
    }),
  }),
  zod.object({}),
]);

@Resolver()
export class SessionResolver {
  private readonly logger = new Logger(SessionResolver.name);

  constructor(private getSessionUseCase: GetSessionUseCase) {}

  // LINE認証を有効化した場合、UseGuardsをアンコメントする
  // @UseGuards(GraphqlLineAuthGuard)
  @Query(() => SessionConnection)
  async sessions(
    @CurrentUser() user: UserProfile,
    @Args() option?: unknown,
  ): Promise<SessionConnection> {
    try {
      this.logger.log('CalledSessions', {
        option: option,
        user: user,
      });

      const parseResult = eventSchema.safeParse(option);
      if (parseResult.success) {
        const sessions = await this.getSessionUseCase.getSession(
          parseResult.data,
        );

        return sessions;
      } else {
        throw new GetSessionResolverValidationError(option, parseResult.error);
      }
    } catch (e) {
      if (e instanceof GetSessionResolverValidationError) {
        throw e;
      }

      throw new GetSessionResolverUnknownError(option, e);
    }
  }
}
