const EventEmitter = require('events').EventEmitter;
const oracledb = require('./oracledb');

/**
 * Creates little helper object
 *
 * @constructor
 * @param {string} title migration filename
 * @param {Function} up function to execute when `up` migration
 * @param {Function} down function to execute when `down` migration
 */
function Migration(title, up, down) {
  this.title = title;
  this.up = up;
  this.down = down;
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
   * @constructor
   * @param {Object} config database connection configuration
   */
  constructor(config) {
    super();

    // database config options
    // currently not used, but exists for future use
    this.config = config;

    // stores migration history from the database
    this.history = [];

    // stores local migration files in a sort order
    this.migrations = [];

    // check if the migration state table exists in the database
    this.checkDatabaseMigrationTable();
  }

  /**
   * Checks if the migration state table exists in the database
   *
   * @returns {Promise} returns Oracle DB connection
   */
  checkDatabaseMigrationTable() {
    return oracledb.checkMigrationTableExists()
      .then(() => this.load())
      .then(() => this.emit('init'))
      .catch(err => this.emit('error', err));
  }

  /**
   * Add a migration to migration list
   *
   * @param {String} title migration filename
   * @param {Function} up executes `up` migration
   * @param {Function} down executes `down` migration
   * @returns {undefined}
   */
  addMigration(title, up, down) {
    this.migrations.push(new Migration(title, up, down));
  }

  /**
   * Saves one executed migration data to database
   *
   * @param {string} title migration name to save in the database
   * @returns {Promise} returns Oracle DB connection
   */
  save(title) {
    const createdTime = parseInt(title.split('-')[0], 10);

    return oracledb.saveMigrateData({
      title,
      createdTime: new Date(createdTime),
      execTime: new Date()
    });
  }

  /**
   * Load migration info from database
   *
   * @returns {Promise} returns Oracle DB connection
   */
  load() {
    const self = this;

    return oracledb.loadMigrateData()
      .then(data => {
        self.history = data.rows.map(e => e.TITLE).sort();
      });
  }

  /**
   * Removes last migration entry in the database
   *
   * @param {string} title removes entry from the database
   * @returns {Promise} returns Oracle DB connection
   */
  removeEntry(title) {
    return oracledb.removeMigrateEntry(title);
  }

  /**
   * Run down migrations and call `cb(err)`
   *
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   * @returns {undefined}
   */
  down(migrationName, cb) {
    this.migrate('down', migrationName, cb);
  }

  /**
   * Run up migrations and call `cb(err)`
   *
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   * @returns {undefined}
   */
  up(migrationName, cb) {
    this.migrate('up', migrationName, cb);
  }

  /**
   * Migrate in the given `direction`, calling `cb(err)`
   *
   * @param {string} direction `up` or `down` direction to execute
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   * @returns {undefined}
   */
  migrate(direction, migrationName, cb) {
    if (typeof migrationName === 'function') {
      cb = migrationName;
      migrationName = null;
    }

    this._migrate(direction, migrationName, err => {
      if (err) {
        this.emit('error', err);
        return cb(err);
      }

      cb();
    });
  }

  /**
   * Perform migration
   *
   * @param {string} direction `up` or `down` direction to execute
   * @param {string} migrationName migration filename
   * @param {Function} cb callback
   * @returns {undefined}
   */
  _migrate(direction, migrationName, cb) {
    const self = this;
    let migrations = [];

    /*
     * Select files for migration
     */
    switch (direction) {
    case 'up':
      /*
       * Remove all database file names (this.history) from local list of files (this.migrations)
       * because only new files should be executed
       */
      migrations = this.migrations.filter(e => !this.history.find(eh => eh === e.title));

      if (migrationName) {
        const index = migrations.findIndex(e => e.title === migrationName);

        /*
         * If file was not found,
         * try to find it in the history (database table) - maybe it was executed before
         * if not - throw error that file doesn't exist
         */
        if (index < 0) {
          let err = `File '${migrationName}' not exist `;

          if (this.history.find(filename => filename === migrationName)) {
            err = `File '${migrationName}' has been executed before`;
          }

          return cb(err);
        }

        migrations = migrations.slice(0, index + 1);
      }

      break;
    case 'down':
      /*
       * When no file name specified, do `down` migration
       * only to one file before the current
       *
       * note: `down` migration is done relative to the entries
       * from the database table
       */
      if (!migrationName) {
        const last = this.history.pop();

        migrations.push(this.migrations.find(e => e.title === last));
        break;
      }

      /*
       * Do full reset and revert all migrations to init state
       */
      if (migrationName === 'all') {
        for (let i = 0; i < this.history.length; i++) {
          const o = this.migrations.find(e => e.title === this.history[i]);

          if (!o) {
            return cb(`File from history '${this.history[i]}' can not be found in local files`);
          }

          migrations.push(o);
        }

        migrations = migrations.reverse();
        break;
      }

      /*
       * Migration file name was specified, so
       * do migration till that file
       *
       * note: Select from history that file
       */
      const index = this.history.findIndex(e => e === migrationName);

      if(index < 0) {
            return cb(`File '${migrationName}' not found`);
      }

      const historyList = this.migrations.filter(e => this.history.find(h => h === e.title));

      migrations = historyList.slice(index).reverse();
      break;
    default: break;
    }

    /**
     * Select next migration file and execute it
     *
     * @param {object} migration migration object to execute
     * @param {string} title migration filename
     * @param {Function} up function to execute when `up` migration
     * @param {Function} down function to execute when `down` migration
     * @returns {undefined}
     */
    function next(migration) {
      if (!migration) {
        return cb(null);
      }

      self.emit('migration', migration, direction);

      migration[direction](err => {
        if (err) {
          return cb(err);
        }

        if (direction === 'up') {
          self.save(migration.title)
            .then(() => next(migrations.shift()))
            .catch(cb);
        } else if (direction === 'down') {
          self.removeEntry(migration.title)
            .then(() => next(migrations.shift()))
            .catch(cb);
        }
      });
    }

    next(migrations.shift());
  }
}

module.exports = Set;
