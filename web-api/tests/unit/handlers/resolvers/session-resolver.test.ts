import { Test, TestingModule } from '@nestjs/testing';
import { SessionRepository } from '../../../../src/infrastructures/session-repository';
import { GetSessionUseCase } from '../../../../src/domains/get-session-use-case';
import { SessionResolver } from '../../../../src/handlers/resolvers/session-resolver';
import { PrismaClientProvider } from '../../../../src/infrastructures/prisma-provider';
import { GetSessionResolverValidationError } from '../../../../src/handlers/errors/session-resolver-error';

describe('sessionのテスト', () => {
  let sessionResolver: SessionResolver;
  let getSessionUseCase: GetSessionUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionResolver,
        GetSessionUseCase,
        SessionRepository,
        PrismaClientProvider,
      ],
    }).compile();

    sessionResolver = module.get(SessionResolver);
    getSessionUseCase = module.get(GetSessionUseCase);
  });

  describe('不正なリクエストの場合', () => {
    describe.each`
      request
      ${null}
      ${undefined}
    `('$requestの場合', ({ request }) => {
      test('Throw GetSessionResolverValidationError', async () => {
        getSessionUseCase.getSession = jest.fn().mockReturnValue({
          data: {
            sessions: {
              nodes: [],
            },
          },
        });

        await expect(sessionResolver.sessions(request)).rejects.toThrowError(
          GetSessionResolverValidationError,
        );
      });
    });
  });

  describe('正常なリクエストの場合', () => {
    describe.each`
      request
      ${{ filter: { speakerName: 'test' } }}
      ${{}}
    `('$requestの場合', ({ request }) => {
      test('Return session', async () => {
        getSessionUseCase.getSession = jest.fn().mockReturnValue({
          data: {
            sessions: {
              nodes: [],
            },
          },
        });

        const res = await sessionResolver.sessions(request);

        expect(getSessionUseCase.getSession).toHaveBeenCalledTimes(1);
        expect(getSessionUseCase.getSession).toHaveBeenCalledWith(request);

        expect(res).toEqual({
          data: {
            sessions: {
              nodes: [],
            },
          },
        });
      });
    });
  });
});
