const SimpleOracleDB = require('simple-oracledb')
const oracledb = require('oracledb')
const fs = require('fs')

SimpleOracleDB.extend(oracledb)

/**
 * Connection configuration for Oracle DB
 */
const dbConfig = {
  user: process.env.NODE_ORACLEDB_USER,
  password : process.env.NODE_ORACLEDB_PASSWORD,
  connectString : process.env.NODE_ORACLEDB_CONNECTIONSTRING,
  // externalAuth : process.env.NODE_ORACLEDB_EXTERNALAUTH ? true : false
}

const sqlDelimiter = '-----'

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
    // externalAuth: dbConfig.externalAuth
  })
}

/**
 * Reads file content
 *
 * @param {string} path path to SQL file
 *
 * @returns {Promise}
 */
function readFile(path) {
  return new Promise( (resolve, reject) => {
    fs.readFile(path, 'utf8', (err, sql) => {
      if(err) return reject(err)

      resolve(sql)
    })
  })
}

/**
 * Just splits sql string to several
 * sql statements and trims it
 *
 * @param {string} str a string to split by delimiter
 * @returns {string}
 */
function splitCommands(str) {
  return str.split(sqlDelimiter).map( e => e.trim())
}

/**
 * Runs transaction on a sequence of sqls
 *
 * @param {array} sqls a list of sql statements
 * @returns {Promise}
 */
function runTransactionSequence(sqls) {
  let _connection
  const actions = []

  for(let i = 0; i < sqls.length; i++) {
    actions.push( cb => {
      if(!_connection) throw new Error('Connection is not estabilished')

      _connection.execute(sqls[i], [], { outFormat: oracledb.OBJECT, autoCommit: false })
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

        resolve()
      });
    })
  })
}

/**
 * Migrates database up
 *
 * @param {Function} next callback
 * @returns {Promise}
 */
exports.up = function(next) {
  return readFile('{up}')
    .then(splitCommands)
    .then(runTransactionSequence)
    .then(() => next(null))
    .catch(err => {
      console.log(`'up' migration was failed so rollback changes were applied using 'down' migration`)

      exports.down( () => {
        next(err)
      })
    })
};

/**
 * Migrates database down
 *
 * @param {Function} next callback
 * @returns {Promise}
 */
exports.down = function(next) {
  return readFile('{down}')
    .then(splitCommands)
    .then(runTransactionSequence)
    .then(() => next(null))
    .catch(err => {
      // console.log(`'down' migration was failed`)
      next(err)
    })
};
