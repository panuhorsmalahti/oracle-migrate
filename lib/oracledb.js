const assert = require('assert');
const path = require('path');
const fs = require('fs');
const oracledb = require('oracledb');
const SimpleOracleDB = require('simple-oracledb');

SimpleOracleDB.extend(oracledb);

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
const sqlLoadMigrationData = `SELECT * FROM MIGRATIONS`;

/**
 * Removes one row from migration table
 */
const sqlRemoveMigrationEntry = `DELETE FROM MIGRATIONS WHERE TITLE = :title`;

function log(key, msg) {
  console.log('  \033[90m%s :\033[0m \033[36m%s\033[0m', key, msg); // eslint-disable-line
}

/**
 * Reads config file and uses configuration to connect to oracle db
 * @param  {string} path path to config file
 * @return {undefined}
 */
function readConfig() {
  assert(process.env.NODE_ENV, 'NODE_ENV should exist with valid value');

  const file = fs.readFileSync(path.join(process.cwd(), '.oracle-migrate'));
  const config = JSON.parse(file)

  return config[process.env.NODE_ENV];
}

let configFile;

try {
  configFile = readConfig();
} catch(ex) {
  log('Error', ex.message);
  process.exit(1);
}

/**
 * Connection configuration for Oracle DB
 *
 * note: currently `externalAuth` is not supported
 */
const dbConfig = {
  user: `"${configFile.username}"`,
  password : configFile.password,
  connectString : configFile.connectionString
};

/**
 * Returns connection to Oracle DB
 *
 * @returns {Promise} returns Oracle DB connection
 */
function getConnection() {
  return oracledb.getConnection({
    user: dbConfig.user,
    password: dbConfig.password,
    connectString: dbConfig.connectString
  });
}

/**
 * Runs transaction on a sequence of sqls
 *
 * @param {array} sqls a list of SQL commands to execute
 * @param {object} config configuration for transactions
 * @returns {Promise} returns result of executed transaction
 */
function runTransactionSequence(sqls, config) {
  let _connection;
  const actions = [];

  for (let i = 0; i < sqls.length; i++) {
    actions.push(cb => {
      _connection.execute(sqls[i], [], config || { outFormat: oracledb.OBJECT, autoCommit: false })
        .then(data => {
          cb(null, data);
        })
        .catch(cb);
    });
  }

  return new Promise((resolve, reject) => {
    getConnection()
    .then(connection => {
      _connection = connection;

      // run all actions in sequence
      connection.transaction(actions, {
        sequence: true
      }, (err, output) => {
        if (err) {
          return reject(err);
        }

        resolve(output);
      });
    });
  });
}

/**
 * Checks if migrations table exists in database
 * if not - creates it
 *
 * @returns {Promise} returns result of checking if migration table exists in database
 */
function checkMigrationTableExists() {
  return runTransactionSequence(sqlCreateMigrationTableArray)
    .then(() => {}, err => {
      if (err.message && !err.message.includes('00955')) {
        throw err;
      }
    });
}

/**
 * Adds new row to the table of migrations in the database
 *
 * @param {object} row Migration file object
 * @param {string} row.title filename
 * @param {number} row.created_time timestamp when migration file was created
 * @param {number} row.exec_time timestamp when migration file was executed
 * @returns {Promise} returns result of saving migration entry in database
 */
function saveMigrateData(row) {
  return getConnection()
    .then(connection => {
      return connection.execute(sqlSaveMigrationData, [
        row.title,
        row.createdTime,
        row.execTime
      ], {outFormat: oracledb.OBJECT})
        .then(() => {
          return connection.commit();
        });
    });
}

/**
 * Loads migration history (from the database)
 *
 * @returns {Promise} returns migration table
 */
function loadMigrateData() {
  return getConnection()
    .then(connection => {
      return connection.execute(sqlLoadMigrationData, [], {outFormat: oracledb.OBJECT});
    });
}

/**
 * Removes one migration entry from history (database table)
 *
 * @param {string} title name of migration entry to remove
 * @returns {Promise} return result after removing migration entry from database
 */
function removeMigrateEntry(title) {
  return getConnection()
    .then(connection => {
      return connection.execute(sqlRemoveMigrationEntry, [title], {outFormat: oracledb.OBJECT})
        .then(() => {
          return connection.commit();
        });
    });
}

module.exports = {
  config: dbConfig,
  checkMigrationTableExists,
  loadMigrateData,
  saveMigrateData,
  removeMigrateEntry
};
