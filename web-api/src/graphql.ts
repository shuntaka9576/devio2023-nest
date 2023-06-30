
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class SessionsInput {
    speakerName?: Nullable<string>;
}

export class Speaker {
    id: string;
    name: string;
}

export class Session {
    id: string;
    title: string;
    speakers: Speaker[];
    date: string;
    start: string;
    end: string;
}

export class SessionConnection {
    nodes: Session[];
}

export abstract class IQuery {
    abstract sessions(filter?: Nullable<SessionsInput>): SessionConnection | Promise<SessionConnection>;
}

type Nullable<T> = T | null;
