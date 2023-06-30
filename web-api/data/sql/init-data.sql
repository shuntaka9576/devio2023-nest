-- @Relationを設定した場合必要
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE sessions;
TRUNCATE TABLE session_speakers;
TRUNCATE TABLE speakers;

SELECT 'sessionsのデータ投入';
LOAD DATA LOCAL INFILE './data/csv/sessions.csv' INTO
TABLE sessions FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' IGNORE 1 LINES (@1, @2, @3, @4, @5, @6, @7)
SET
  session_id = @1,
  title = @2,
  date = @3,
  start = @4,
  end = @5;
SHOW WARNINGS;

SELECT 'session_speakersのデータ投入';
LOAD DATA LOCAL INFILE './data/csv/session_speakers.csv' INTO
TABLE session_speakers FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' IGNORE 1 LINES (@1, @2, @3, @4)
SET
  session_id = @1,
  speaker_id = @2;
SHOW WARNINGS;

SELECT 'speakersのデータ投入';
LOAD DATA LOCAL INFILE './data/csv/speakers.csv' INTO
TABLE speakers FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' IGNORE 1 LINES (@1, @2, @3, @4)
SET
  speaker_id = @1,
  name = @2;
SHOW WARNINGS;

-- @Relationを設定した場合必要
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
