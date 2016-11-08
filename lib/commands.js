const assert = require('assert');
const fs = require('fs');
const path = require('path');

const OracleDB = require('./oracledb');
const tools = require('./tools');

/**
 * Migration template
 */
const templateFile = fs.readFileSync(path.join(__dirname, '../', 'templates/create.js'), 'utf8');

/**
 * Shows history of migrations fetched form the database table
 *
 * @param {object} config connection config
 * @returns {undefined}
 */
function migrationHistory(config) {
  const oracledb = new OracleDB(config);

  oracledb.loadMigrateData()
    .then(data => {
      if (data.rows.length === 0) {
        return tools.log('history', 'no history to show');
      }

      tools.log('history', 'from database');
      data.rows
        .sort()
        .map(e => e.TITLE)
        .forEach(e => tools.log('       ', e));
    })
    .catch(err => {
      if(err.message.includes('00942')) {
        return tools.abort('Migration table does not exists in the database');
      }

      tools.abort(err.message);
    });
}

/**
 * Create new file from template with title (if present)
 *
 * @param {string} title migration script title
 * @param {string} filepath name of migration script to create
 * @returns {undefined}
 */
function createMigrationScript(title, filepath) {
  let curr = Date.now();

  assert(filepath, 'path should be defined');

  if(!title) {
    tools.log('error', 'title is not specified');
    return;
  }

  title = tools.slugify(title);
  title = `${curr}-${title}`;

  const o = createSql(title);
  let templateModified = templateFile;

  templateModified = templateModified.replace(/{up}/, o.pathUp);
  templateModified = templateModified.replace(/{down}/, o.pathDown);

  createMigrationFile(title, templateModified, filepath);
}

/**
 * Create a migration with the given `name`.
 * Creates related sql files in sql folder
 *
 * @param {string} name file name
 * @param {string} template template file string
 * @param {string} filepath path to migration script
 * @returns {undefined}
 */
function createMigrationFile(name, template, filepath) {
  const p = path.join(`migrations/${name}.js`);

  tools.log('create', path.join(filepath, p));
  fs.writeFileSync(p, template);
}

/**
 * Creates sqls
 *
 * @param {string} name file name
 * @returns {object} returns 2 paths
 */
function createSql(name) {
  const pathUp = `migrations/sql/${name}-up.sql`;
  const pathDown = `migrations/sql/${name}-down.sql`;

  fs.writeFileSync(pathUp, '');
  fs.writeFileSync(pathDown, '');

  return { pathUp, pathDown };
}

/**
 * Shows local migration files
 *
 * @param {string} filepath path to folder with migrations. Default path is `./migrations`
 * @returns {undefined}
 */
function listLocalMigrations(filepath = './migrations') {
  tools.log('history', 'local migration files');

  fs.readdirSync(filepath)
    .filter(file => file.match(/^\d+.*\.js$/))
    .sort()
    .forEach(file => {
      tools.log('       ', file);
    });
}

/**
 * Perform a migration in the given `direction`.
 *
 * @param {number} direction direction
 * @param {string} migrationName migration file name if present
 * @param {object} config connection config
 * @returns {undefined}
 */
function performMigration(direction, migrationName, config) {
  assert(config, 'config should be defined');

  const set = tools.load('migrations', config);

  set.on('init', () => {
    /*
     * Just log to console every migration
     */
    set.on('migration', (migration, _direction) => {
      tools.log(_direction, migration.title);
    });

    /*
     * Do migration
     */
    set[direction](migrationName, err => {
      if (err) {
        return tools.abort(err);
      }

      tools.log('migration', 'complete');
      process.exit(0);
    });
  });

  set.on('error', err => {
    return tools.abort(err);
  });
}

/**
 * Prepare folders if they don't exist
 *
 * ./migrations
 * ./migrations/sql
 */
function prepareMigrationFolderStructure() {
  try {
    fs.mkdirSync(path.join('migrations'), 0o774); // eslint-disable-line
  } catch (ex) {} // eslint-disable-line

  try {
    fs.mkdirSync(path.join('migrations', 'sql'), 0o774); // eslint-disable-line
  } catch (ex) {} // eslint-disable-line

}

module.exports = {
  createMigrationScript,
  createSql,
  migrationHistory,
  listLocalMigrations,
  performMigration,
  prepareMigrationFolderStructure
}
