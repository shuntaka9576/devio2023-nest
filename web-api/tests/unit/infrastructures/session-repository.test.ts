import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientProvider } from '../../../src/infrastructures/prisma-provider';
import { SessionRepository } from '../../../src/infrastructures/session-repository';

describe('getSessionUseRawのテスト', () => {
  let sessionRepository: SessionRepository;
  let prismaClientProvider: PrismaClientProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionRepository, PrismaClientProvider],
    }).compile();

    sessionRepository = module.get(SessionRepository);
    prismaClientProvider = module.get(PrismaClientProvider);
  });

  describe('正常なリクエストの場合', () => {
    test('Session配列が返却される', async () => {
      const txMock = {
        $queryRaw: jest.fn().mockReturnValue([
          {
            sessionId: 'session1',
            title: 'セッションタイトル1',
            start: '13:30',
            end: '14:10',
            date: '2023/07/07',
            speakerId: 'CM001',
            name: 'speakerName1',
          },
          {
            sessionId: 'session1',
            title: 'セッションタイトル1',
            start: '13:30',
            end: '14:10',
            date: '2023/07/07',
            speakerId: 'CM002',
            name: 'speakerName2',
          },
          {
            sessionId: 'session4',
            title: 'セッションタイトル4',
            start: '10:50',
            end: '11:30',
            date: '2023/07/08',
            speakerId: 'CM012',
            name: 'speakerName12',
          },
        ]),
      };

      prismaClientProvider.$transaction = jest
        .fn()
        .mockImplementation(async (callback) => {
          return callback(txMock);
        });
      const session = await sessionRepository.getSessionUseRaw();

      expect(prismaClientProvider.$transaction).toHaveBeenCalledTimes(1);

      expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(txMock.$queryRaw).toHaveBeenCalledWith(
        [
          `SELECT 
    sessions.session_id AS sessionId,
    sessions.title AS title,
    sessions.start AS start,
    sessions.end AS end,
    sessions.date AS date,
    session_speakers.speaker_id AS speakerId,
    speakers.name AS name
FROM
    sessions
        LEFT JOIN
    session_speakers ON sessions.session_id = session_speakers.session_id
        LEFT JOIN
    speakers ON session_speakers.speaker_id = speakers.speaker_id
    `,
          ';',
        ],
        { strings: [''], values: [] },
      );

      expect(session).toEqual([
        {
          date: '2023/07/07',
          end: '14:10',
          id: 'session1',
          speakers: [
            { id: 'CM001', name: 'speakerName1' },
            { id: 'CM002', name: 'speakerName2' },
          ],
          start: '13:30',
          title: 'セッションタイトル1',
        },
        {
          date: '2023/07/08',
          end: '11:30',
          id: 'session4',
          speakers: [{ id: 'CM012', name: 'speakerName12' }],
          start: '10:50',
          title: 'セッションタイトル4',
        },
      ]);
    });
  });
});
