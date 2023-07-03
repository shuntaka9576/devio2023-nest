import type { ColumnType } from 'kysely';
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Sessions = {
  session_id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type SessionSpeakers = {
  session_id: string;
  speaker_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type Speakers = {
  speaker_id: string;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type DB = {
  session_speakers: SessionSpeakers;
  sessions: Sessions;
  speakers: Speakers;
};
