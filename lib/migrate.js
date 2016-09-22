/*!
 * Migrate
 * Copyright(c) 2016
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
const Set = require('./set')
const path = require('path')
const fs = require('fs')

/**
 * Expose the migrate function.
 */
exports = module.exports = migrate

function migrate(title, up, down) {
  // migration
  if ('string' == typeof title && up && down) {
    migrate.set.addMigration(title, up, down)
  // specify migration file
  } else if ('string' == typeof title) {
    migrate.set = new Set(title)
  // no migration path
  } else if (!migrate.set) {
    throw new Error('must invoke migrate(path) before running migrations')
  // run migrations
  } else {
    return migrate.set
  }
}

/**
 * Loads all files files from `migration` directory
 * and creates a Set of migrations
 *
 * @param {string} migrationsDirectory directory path
 * @param {object} config database config
 * @param {string} config.user username
 * @param {string} config.password user password
 * @param {string} config.connectString database url with port
 * @param {string} config.externalAuth should do external auth
 */
exports.load = function (migrationsDirectory, config) {
  const dir = path.resolve(migrationsDirectory)
  const set = new Set(config)

  /*
   * Read all files in a 'migrations' directory,
   * sort them by name (timestamp order),
   * require and add to the migration list
   */
  fs.readdirSync(dir)
    .filter( file => file.match(/^\d+.*\.js$/) )
    .sort()
    .forEach( file => {
      const mod = require(path.join(dir, file))
      set.addMigration(file, mod.up, mod.down)
    })

  return set
}
