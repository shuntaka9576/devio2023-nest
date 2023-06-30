import { Injectable } from '@nestjs/common';
import { SessionConnection } from '../graphql';
import { SessionRepository } from '../infrastructures/session-repository';
import { GetSessionUseCaseUnknownError } from './errors/get-session-use-case-error';

@Injectable()
export class GetSessionUseCase {
  constructor(private sessionRepository: SessionRepository) {}

  async getSession(params?: {
    filter?: { speakerName: string };
  }): Promise<SessionConnection> {
    try {
      const sessions = await (async () => {
        if (params?.filter?.speakerName != null) {
          /* --- @Relationを使う場合(start) ---
          const sessions = await this.sessionRepository.getSession(
            params.filter.speakerName,
          );
          --- @Relationを使う場合(end) --- */

          /* --- @Relationを使わない場合(start) ---
          const sessions = await this.sessionRepository.getSessionUseRaw(
            params.filter.speakerName,
          );
          --- @Relationを使う場合(end) --- */
          const sessions = await this.sessionRepository.getSessionUseKysely(
            params.filter.speakerName,
          );

          return sessions;
        } else {
          return [];
        }
      })();

      return {
        nodes: sessions,
      };
    } catch (e) {
      throw new GetSessionUseCaseUnknownError(params, e);
    }
  }
}
