const SimpleOracleDB = require('simple-oracledb')
const oracledb = require('oracledb')

SimpleOracleDB.extend(oracledb)

/**
 * Creates migration table in the database
 *
 * Oracle SQLs can not contain multiple sequences, thats why
 * we divided them and created an array of sequences.
 * Later they should be executed by transaction
 */
const sqlCreateMigrationTableArray = [
`
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
`
]

/**
 * Rollback changes if something goes wrong
 * Just do reverse operations to that you done in transaction
 *
 * Currently nothing should be done, because migration state table
 * contains needed info for us and should exist
 */
const sqlCreateMigrationTableArrayRollback = ``

const sqlSaveMigrationData = `
INSERT INTO MIGRATIONS (ID, TITLE, CREATED_TIME, EXEC_TIME)
VALUES
(
  NULL,
  :title,
  :created_time,
  :exec_time
)
`

/**
 * Loads all rows from migration table
 */
const sqlLoadMigrationData = `
SELECT * FROM MIGRATIONS
`

/**
 * Removes one row from migration table
 */
const sqlRemoveMigrationEntry = `
DELETE FROM MIGRATIONS WHERE TITLE = :title
`

/**
 * Connection configuration for Oracle DB
 */
const dbConfig = {
  user: process.env.NODE_ORACLEDB_USER,
  password : process.env.NODE_ORACLEDB_PASSWORD,
  connectString : process.env.NODE_ORACLEDB_CONNECTIONSTRING,
  // externalAuth : process.env.NODE_ORACLEDB_EXTERNALAUTH ? true : false
}

/**
 * Returns connection to Oracle DB
 *
 * @return {Promise}
 */
function getConnection() {
  return oracledb.getConnection({
    user: dbConfig.user,
    password: dbConfig.password,
    connectString: dbConfig.connectString,
    externalAuth: dbConfig.externalAuth
  })
}

/**
 * Runs transaction on a sequence of sqls
 */
function runTransactionSequence(sqls, params, config) {
  let _connection
  const actions = []

  for(let i = 0; i < sqls.length; i++) {
    actions.push( cb => {
      _connection.execute(sqls[i], params || [], config || { outFormat: oracledb.OBJECT, autoCommit: false })
        .then( data => {
          cb(null, data)
        })
        .catch(cb)
    })
  }

  return new Promise( (resolve, reject) => {
    getConnection()
    .then( connection => {
      _connection = connection

      //run all actions in sequence
      connection.transaction(actions, {
        sequence: true
      }, (err, output) => {
        if(err) return reject(err)

        resolve(output)
      });
    })
  })
}

/**
 * Runs sql code
 */
function runSql(sql, params, config) {
  return getConnection()
    .then( connection => {
      return connection.execute(sql, params || [], config || {outFormat: oracledb.OBJECT})
        /*.then( res => {
          return connection.release()
        }, err => {
          connection.release()
          return err
        })*/


        /*.catch(err => {
          console.log(`err: ${err}`)

          return reject() && connection.release()
        })*/
    })
}

/**
 * Checks if migrations table exists in database
 * if not - creates it
 */
function checkMigrationTableExists() {
  return runTransactionSequence(sqlCreateMigrationTableArray)
    .then( () => {}, err => {
      if(err.message && !err.message.includes('00955')) throw err
    })
}

/**
 * Adds new row to the table of migrations in the database
 *
 * @param {object} row Migration file object
 * @param {string} row.title filename
 * @param {number} row.created_time timestamp when migration file was created
 * @param {number} row.exec_time timestamp when migration file was executed
 */
function saveMigrateData(row) {
  return getConnection()
    .then( connection => {
      return connection.execute(sqlSaveMigrationData, [
        row.title,
        row.created_time,
        row.exec_time
      ], {outFormat: oracledb.OBJECT})
        .then( () => {
          return connection.commit()
        })
    })
}

/**
 * Loads migration history (from the database)
 */
function loadMigrateData() {
  return getConnection()
    .then( connection => {
      return connection.execute(sqlLoadMigrationData, [], {outFormat: oracledb.OBJECT})
    })
}

/**
 * Removes one migration entry from history (database table)
 */
function removeMigrateEntry(title) {
  return getConnection()
    .then( connection => {
      return connection.execute(sqlRemoveMigrationEntry, [ title ], {outFormat: oracledb.OBJECT})
        .then( () => {
          return connection.commit()
        })
    })
}

module.exports = {
  config: dbConfig,
  runSql,
  checkMigrationTableExists,
  loadMigrateData,
  saveMigrateData,
  removeMigrateEntry
}
