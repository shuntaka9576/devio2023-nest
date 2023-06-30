import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GetSessionRepositoryUnknownError } from './errors/session-repository-error';
import { PrismaClientProvider } from './prisma-provider';
import * as Console from 'console';

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
