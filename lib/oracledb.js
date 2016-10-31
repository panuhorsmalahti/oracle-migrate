const assert = require('assert');
const oracledb = require('oracledb');
const SimpleOracleDB = require('simple-oracledb');

const sql = require('./sql');

SimpleOracleDB.extend(oracledb);

oracledb.autoCommit = false;
oracledb.outFormat = oracledb.OBJECT;

class OracleDB {
  constructor(config) {
    assert(config, 'config should be present!');

    this.config = config;
  }

  /**
   * Returns connection to Oracle DB
   *
   * @returns {Promise} returns Oracle DB connection
   */
  getConnection() {
    return oracledb.getConnection({
      user: this.config.username,
      password: this.config.password,
      connectString: this.config.connectionString
    });
  }

  /**
   * Checks if migrations table exists in database
   * if not - creates it
   *
   * @returns {Promise} returns result of checking if migration table exists in database
   */
  checkMigrationTableExists() {
    return this.runTransactionSequence(sql.sqlCreateMigrationTableArray)
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
  saveMigrateData(row) {
    return this.getConnection()
      .then(connection => {
        return connection.execute(sql.sqlSaveMigrationData, [
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
  loadMigrateData() {
    return this.getConnection()
      .then(connection => {
        return connection.execute(sql.sqlLoadMigrationData, []);
      });
  }

  /**
   * Removes one migration entry from history (database table)
   *
   * @param {string} title name of migration entry to remove
   * @returns {Promise} return result after removing migration entry from database
   */
  removeMigrateEntry(title) {
    return this.getConnection()
      .then(connection => {
        return connection.execute(sql.sqlRemoveMigrationEntry, [title])
          .then(() => {
            return connection.commit();
          });
      });
  }

  /**
   * Runs transaction on a sequence of sqls
   *
   * @param {array} sqls a list of sql statements
   * @returns {Promise} returns result of executed transaction
   */
  runTransactionSequence(sqls) {
    const actions = [];
    let _connection;

    for (let i = 0; i < sqls.length; i++) {
      actions.push(cb => {
        if (!_connection) {
          throw new Error('Connection is not estabilished');
        }

        _connection.execute(sqls[i], [])
          .then(data => {
            cb(null, data);
          })
          .catch(cb);
      });
    }

    return new Promise((resolve, reject) => {
      this.getConnection()
      .then(connection => {
        _connection = connection;

        // run all actions in sequence
        connection.transaction(actions, {
          sequence: true
        }, error => {
          if (error) {
            _connection.rollback();
            return reject(error);
          }

          resolve();
        });
      });
    });
  }
}

module.exports = OracleDB;
