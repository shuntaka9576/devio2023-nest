SELECT 
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
WHERE
    speakers.name = 'speakerName1';

COMMIT;