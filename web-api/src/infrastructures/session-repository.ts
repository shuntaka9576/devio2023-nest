import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GetSessionRepositoryUnknownError } from './errors/session-repository-error';
import { PrismaClientProvider } from './prisma-provider';
import * as Console from 'console';
import { Kysely, MysqlDialect } from 'kysely';
import { DB } from 'src/db/types';
import { createPool } from 'mysql2';

interface SessionRecord {
  sessionId: string;
  title: string;
  start: string;
  end: string;
  date: string;
  speakerId: string;
  name: string;
}

interface Session {
  id: string;
  title: string;
  speakers: {
    id: string;
    name: string;
  }[];
  date: string;
  start: string;
  end: string;
}

@Injectable()
export class SessionRepository {
  constructor(private prismaClient: PrismaClientProvider) {}

  /* --- @Relationを使う場合(start) ---
  async getSession(speakerName?: string): Promise<Session[]> {
    const records = await this.prismaClient.$transaction((tx) =>
      tx.sessionSpeakers.findMany({
        select: {
          speakerId: true,
          sessions: {
            select: {
              sessionId: true,
              title: true,
              start: true,
              end: true,
              date: true,
            },
          },
          speakers: {
            select: {
              speakerId: true,
              name: true,
            },
          },
        },
        where: {
          speakers: {
            name: speakerName,
          },
        },
      }),
    );

    let sessions: Session[] = [];

    records.map((record) => {
      const sessionIndex = sessions.findIndex(
        (session) => session.id === record.sessions.sessionId,
      );

      if (sessionIndex !== -1) {
        sessions[sessionIndex].speakers = [
          ...sessions[sessionIndex].speakers,
          {
            id: record.speakerId,
            name: record.speakers.name,
          },
        ];
      } else {
        sessions = [
          ...sessions,
          {
            id: record.sessions.sessionId,
            title: record.sessions.title,
            start: record.sessions.start,
            end: record.sessions.end,
            date: record.sessions.date,
            speakers: [
              {
                id: record.speakerId,
                name: record.speakers.name,
              },
            ],
          },
        ];
      }
    });

    return sessions;
  }
  --- @Relationを使う場合(end) --- */

  async getSessionUseRaw(speakerName?: string): Promise<Session[]> {
    try {
      const records = await this.prismaClient.$transaction(async (tx) => {
        return await tx.$queryRaw<SessionRecord[]>`SELECT 
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
    ${
      speakerName
        ? Prisma.sql`WHERE speakers.name = ${speakerName}`
        : Prisma.sql``
    };`;
      });

      let sessions: Session[] = [];

      records.map((record) => {
        const sessionIndex = sessions.findIndex(
          (session) => session.id === record.sessionId,
        );

        if (sessionIndex !== -1) {
          sessions[sessionIndex].speakers = [
            ...sessions[sessionIndex].speakers,
            {
              id: record.speakerId,
              name: record.name,
            },
          ];
        } else {
          sessions = [
            ...sessions,
            {
              id: record.sessionId,
              title: record.title,
              start: record.start,
              end: record.end,
              date: record.date,
              speakers: [
                {
                  id: record.speakerId,
                  name: record.name,
                },
              ],
            },
          ];
        }
      });

      return sessions;
    } catch (e) {
      throw new GetSessionRepositoryUnknownError(
        { speakerName: speakerName },
        e,
      );
    }
  }

  async getSessionUseKysely(speakerName: string): Promise<Session[]> {
    try {
      // FIXME: プロダクション利用の場合、コネクション初期化処理は共通化すること
      // あくまで挙動を確認するための目的
      const db = new Kysely<DB>({
        dialect: new MysqlDialect({
          pool: createPool({
            database: process.env.DB_DBNAM,
            host: 'localhost',
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            port: 3306,
            connectionLimit: 10,
          }),
        }),
      });

      const records = await db
        .selectFrom('sessions')
        .select([
          'sessions.session_id',
          'sessions.title',
          'sessions.start',
          'sessions.end',
          'sessions.date',
        ])
        .leftJoin(
          'session_speakers',
          'sessions.session_id',
          'session_speakers.session_id',
        )
        .select(['session_speakers.speaker_id'])
        .leftJoin(
          'speakers',
          'session_speakers.speaker_id',
          'speakers.speaker_id',
        )
        .select(['speakers.name'])
        .where('speakers.name', '=', speakerName)
        .execute();

      let sessions: Session[] = [];

      if (records.length > 1) {
        records.map((record) => {
          console.log(record);
        });
      }

      records.map((record) => {
        const sessionIndex = sessions.findIndex(
          (session) => session.id === record.session_id,
        );

        // Note:
        // 外部キー制約がないからnullになりうる
        // queryRawでは見落としがちだと思う...
        // kyselyの型推論は安心感がある
        if (record.speaker_id == null || record.name == null) {
          throw new Error('invalid data');
        }

        if (sessionIndex !== -1) {
          sessions[sessionIndex].speakers = [
            ...sessions[sessionIndex].speakers,
            {
              id: record.speaker_id,
              name: record.name,
            },
          ];
        } else {
          sessions = [
            ...sessions,
            {
              id: record.session_id,
              title: record.title,
              start: record.start,
              end: record.end,
              date: record.date,
              speakers: [
                {
                  id: record.speaker_id,
                  name: record.name,
                },
              ],
            },
          ];
        }
      });

      return sessions;
    } catch (e) {
      throw new GetSessionRepositoryUnknownError(
        { speakerName: speakerName },
        e,
      );
    }
  }

  async sampleQueryRawUnafe(): Promise<void> {
    const words = ['speakerName1', 'speakerName2', 'speakerName3'];
    let bindValues: string[] = [];

    words.map((word) => {
      bindValues = [...bindValues, word];
    });

    const getSpeakerQuery = `SELECT
    speaker_id
FROM
    speakers
WHERE
   name like ?`; // ?がプリペアードステートメントになり、インジェクション対策

    let execQuery = '';

    words.map((_word, idx) => {
      if (idx < words.length - 1) {
        execQuery += `${getSpeakerQuery}
        UNION ALL
`;
      } else {
        execQuery += getSpeakerQuery + ';';
      }
    });

    const res = await this.prismaClient.$transaction(async (tx) => {
      return await tx.$queryRawUnsafe(execQuery, ...bindValues);
    });

    Console.log(JSON.stringify(res));
  }
}
