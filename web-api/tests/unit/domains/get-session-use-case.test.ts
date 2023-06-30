import { Test, TestingModule } from '@nestjs/testing';
import { GetSessionUseCase } from '../../../src/domains/get-session-use-case';
import { PrismaClientProvider } from '../../../src/infrastructures/prisma-provider';
import { SessionRepository } from '../../../src/infrastructures/session-repository';

describe('sessionのテスト', () => {
  let getSessionUseCase: GetSessionUseCase;
  let sessionRepository: SessionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetSessionUseCase, SessionRepository, PrismaClientProvider],
    }).compile();

    getSessionUseCase = module.get(GetSessionUseCase);
    sessionRepository = module.get(SessionRepository);
  });

  describe('正常なリクエストの場合', () => {
    test('Return session', async () => {
      sessionRepository.getSessionUseRaw = jest.fn().mockReturnValue([
        {
          id: 'session1',
          title: 'セッションタイトル1',
          start: '13:30',
          end: '14:10',
          date: '2023/07/07',
          speakers: [{ id: 'CM001', name: 'speakerName1' }],
        },
      ]);

      const res = await getSessionUseCase.getSession({
        filter: { speakerName: 'test' },
      });

      expect(sessionRepository.getSessionUseRaw).toHaveBeenCalledTimes(1);
      expect(sessionRepository.getSessionUseRaw).toHaveBeenCalledWith('test');

      expect(res).toEqual({
        nodes: [
          {
            date: '2023/07/07',
            end: '14:10',
            id: 'session1',
            speakers: [
              {
                id: 'CM001',
                name: 'speakerName1',
              },
            ],
            start: '13:30',
            title: 'セッションタイトル1',
          },
        ],
      });
    });
  });
});
