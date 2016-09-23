const SimpleOracleDB = require('simple-oracledb')
const oracledb = require('oracledb')
const fs = require('fs')

SimpleOracleDB.extend(oracledb)

/**
 * Connection configuration
 * for Oracle DB
 */
const dbConfig = {
  user: process.env.NODE_ORACLEDB_USER,
  password : process.env.NODE_ORACLEDB_PASSWORD,
  connectString : process.env.NODE_ORACLEDB_CONNECTIONSTRING,
  externalAuth : process.env.NODE_ORACLEDB_EXTERNALAUTH ? true : false
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
    externalAuth: dbConfig.externalAuth
  })
}

/**
 * Reads file content
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
 * @param {string} data
 * @returns {string}
 */
function splitCommands(data) {
  return data.split(sqlDelimiter).map( e => e.trim())
}

/**
 * Runs transaction on a sequence of sqls
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
 */
exports.up = function(next) {
  readFile('{up}')
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
 */
exports.down = function(next) {
  readFile('{down}')
    .then(splitCommands)
    .then(runTransactionSequence)
    .then(() => next(null))
    .catch(err => {
      // console.log(`'down' migration was failed`)
      next(err)
    })
};
