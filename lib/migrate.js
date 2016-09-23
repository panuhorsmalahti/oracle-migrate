const Set = require('./set')
const path = require('path')
const fs = require('fs')

/**
 * Loads all files files from `migration` directory
 * and creates a Set of migrations
 *
 * @param {string} migrationsDirectory directory path
 * @param {object} config database config
 * @param {string} config.user username
 * @param {string} config.password user password
 * @param {string} config.connectString database url with port
 *
 * @returns {Set} returns a `Set` object prepared for executing migrations
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
