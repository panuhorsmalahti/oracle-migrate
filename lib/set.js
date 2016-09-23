const EventEmitter = require('events').EventEmitter
const oracledb = require('./oracledb')
const fs = require('fs')

/**
 * Creates little helper object
 *
 * @constructor
 */
function Migration(title, up, down) {
  this.title = title
  this.up = up
  this.down = down
}

/**
 * Manages the Set of all migrations,
 * chooses which one to execute and
 * manages migration state table in the database
 *
 * Emits:
 * `init` - when initialization was completed (migration table
 * from database was loaded)
 * `migration` - when one migration was completed
 * `error` - when something goes wrong
 */
class Set extends EventEmitter {
  /**
   * Initialize a new migration `Set` with the given `path`
   * which is used to store data between migrations.
   *
   *
   * @param {Object} database connection configuration
   */
  constructor(config) {
    super()

    // database config options
    // currently not used, but exists for future use
    this.config = config

    // stores migration history from the database
    this.history = []

    // stores local migration files in a sort order
    this.migrations = []

    // check if the migration state table exists in the database
    this.checkDatabaseMigrationTable()
  }

  /**
   * Checks if the migration state table exists in the database
   *
   * @returns {Promise}
   */
  checkDatabaseMigrationTable() {
    return oracledb.checkMigrationTableExists()
      .then( () => this.load())
      .then( () => this.emit('init'))
      .catch( err => this.emit('error', err))
  }

  /**
   * Add a migration to migration list
   *
   * @param {String} title
   * @param {Function} up
   * @param {Function} down
   */
  addMigration(title, up, down) {
    this.migrations.push(new Migration(title, up, down))
  }

  /**
   * Saves one executed migration data to database
   *
   * @returns {Promise}
   */
  save(title) {
    const created_time = parseInt(title.split('-')[0], 10)

    return oracledb.saveMigrateData({
      title: title,
      created_time: new Date(created_time),
      exec_time: new Date()
    })
  }

  /**
   * Load migration info from database
   *
   * @param {Function} cb
   * @return {Type}
   * @returns {Promise}
   */
  load() {
    const self = this

    return oracledb.loadMigrateData()
      .then( data => {
        self.history = data.rows.map( e => e.TITLE ).sort()
      })
  }

  /**
   * Removes last migration entry in the database
   *
   * @returns {Promise}
   */
  removeEntry(title) {
    return oracledb.removeMigrateEntry(title)
  }

  /**
   * Run down migrations and call `cb(err)`
   *
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   */
  down(migrationName, cb) {
    this.migrate('down', migrationName, cb)
  }

  /**
   * Run up migrations and call `cb(err)`
   *
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   */
  up(migrationName, cb) {
    this.migrate('up', migrationName, cb)
  }

  /**
   * Migrate in the given `direction`, calling `cb(err)`
   *
   * @param {string} direction
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   */
  migrate(direction, migrationName, cb) {
    if (typeof migrationName === 'function') {
      cb = migrationName
      migrationName = null
    }

    this._migrate(direction, migrationName, err => {
      if(err) {
        this.emit('error', err)
        return cb(err)
      }

      cb()
    })
  }

  /**
   * Checks if migration scripts in the database are present in the local folder
   *
   * TODO: complete it
   */
  _validate(cb) {
    const newHistory = this.history.filter( e => this.migrations )

    // TODO create list of filenames which should be removed from server
  }

  /**
   * Perform migration
   */
  _migrate(direction, migrationName, cb) {
    const self = this
    let migrations = []

    /*
     * Select files for migration
     */
    switch (direction) {
      case 'up':
        /*
         * Remove all database file names (this.history) from local list of files (this.migrations)
         * because only new files should be executed
         */
        migrations = this.migrations.filter( e => !this.history.find( eh => eh == e.title ) )

        if(migrationName) {
          const index = migrations.findIndex( e => e.title === migrationName )

          /*
           * If file was not found,
           * try to find it in the history (database table) - maybe it was executed before
           * if not - throw error that file doesn't exist
           */
          if(index < 0) {
              let err = `File '${migrationName}' not exist `

              if(this.history.find( filename => filename === migrationName)) {
                err = `File '${migrationName}' has been executed before`
              }

              return cb(err)
          }

          migrations = migrations.slice(0, index + 1)
        }

        break
      case 'down':
        /*
         * When no file name specified, do `down` migration
         * only to one file before the current
         *
         * note: `down` migration is done relative to the entries
         * from the database table
         */

        if(!migrationName) {
          const last = this.history.pop()
          migrations.push(this.migrations.find( e => e.title === last ))
        } else {
          /*
           * Do full reset and revert all migrations to init state
           */
          if(migrationName === 'all') {
            for(let i = 0; i < this.history.length; i++) {
              const o = this.migrations.find( e => e.title === this.history[i])

              if(!o) {
                const err = `File from history '${this.history[i]}' can not be found in local files`
                return cb(err)
              }

              migrations.push(o)
            }

            migrations = migrations.reverse()
          } else {
            /*
             * Migration file name was specified, so
             * do migration till that file
             *
             * note: Select from history that file
             */
            const index = this.history.findIndex( e => e === migrationName )
            const historyList = this.migrations.filter( e => this.history.find( h => h === e.title))

            migrations = historyList.slice(index).reverse()
          }
        }

        break
    }

    /**
     * Select next migration file and execute it
     */
    function next(migration) {
      if (!migration) return cb(null)

      self.emit('migration', migration, direction)

      migration[direction]( err => {
        if (err) return cb(err)

        if(direction == 'up') {
          self.save(migration.title)
            .then( () => next(migrations.shift()) )
            .catch(cb)
        } else if(direction === 'down'){
          self.removeEntry(migration.title)
            .then( () => next(migrations.shift()))
            .catch(cb)
        }
      })
    }

    next(migrations.shift())
  }
}

module.exports = Set;
