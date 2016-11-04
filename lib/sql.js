/**
 * Creates migration table in the database
 *
 * Oracle SQLs can not contain multiple sequences, thats why
 * we divided them and created an array of sequences.
 * Later they should be executed by transaction
 */
const sqlCreateMigrationTableArray = [`
CREATE TABLE MIGRATIONS
(
  ID VARCHAR2(1000),
  TITLE VARCHAR2(1000) NOT NULL,
  CREATED_TIME DATE NOT NULL,
  EXEC_TIME DATE NOT NULL,
  CONSTRAINT MIGRATIONS_PK PRIMARY KEY
  (
    ID
  )
  ENABLE
)
`,

`COMMENT ON COLUMN MIGRATIONS.ID IS 'Autoincrement id'`,
`COMMENT ON COLUMN MIGRATIONS.TITLE IS 'Migration script name'`,
`COMMENT ON COLUMN MIGRATIONS.CREATED_TIME IS 'Date when migration script was created'`,
`COMMENT ON COLUMN MIGRATIONS.EXEC_TIME IS 'Date when migration script was executed'`,
`CREATE SEQUENCE MIGRATIONS_SEQ1`,

`
CREATE TRIGGER MIGRATIONS_TRG
BEFORE INSERT ON MIGRATIONS
FOR EACH ROW
BEGIN
  <<COLUMN_SEQUENCES>>
  BEGIN
    IF INSERTING AND :NEW.ID IS NULL THEN
      SELECT MIGRATIONS_SEQ1.NEXTVAL INTO :NEW.ID FROM SYS.DUAL;
    END IF;
  END COLUMN_SEQUENCES;
END;
`];

/**
 * Rollback changes if something goes wrong
 * Just do reverse operations to that you done in transaction
 *
 * Currently nothing should be done, because migration state table
 * contains needed info for us and should exist
 */
const sqlCreateMigrationTableArrayRollback = [
  `drop table MIGRATIONS`,
  `drop sequence MIGRATIONS_SEQ1`
];

/**
 * SQL which saves executed migration entry in the database table
 */
const sqlSaveMigrationData = `
INSERT INTO MIGRATIONS (ID, TITLE, CREATED_TIME, EXEC_TIME)
VALUES
(
  NULL,
  :title,
  :createdTime,
  :execTime
)`;

/**
 * Loads all rows from migration table
 */
const sqlLoadMigrationData = 'SELECT * FROM MIGRATIONS';

/**
 * Removes one row from migration table
 */
const sqlRemoveMigrationEntry = 'DELETE FROM MIGRATIONS WHERE TITLE = :title';

module.exports = {
  sqlCreateMigrationTableArray,
  sqlCreateMigrationTableArrayRollback,
  sqlLoadMigrationData,
  sqlRemoveMigrationEntry,
  sqlSaveMigrationData
};
