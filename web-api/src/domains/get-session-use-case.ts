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
      // queryRawを使った場合
      // const sessions = await this.sessionRepository.getSessionUseRaw(
      //   params?.filter?.speakerName,
      // );

      // @Relationを使った場合
      const sessions = await this.sessionRepository.getSession(
        params?.filter?.speakerName,
      );

      return {
        nodes: sessions,
      };
    } catch (e) {
      throw new GetSessionUseCaseUnknownError(params, e);
    }
  }
}
