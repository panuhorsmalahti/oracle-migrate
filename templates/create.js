const migrate = require('oracle-migrate');

/**
 * Migrates database up
 *
 * @param {Function} next callback
 * @returns {Promise} returns result of executed `up` migration
 */
exports.up = function (next) {
  return migrate.readFile('{up}');
};

/**
 * Migrates database down
 *
 * @param {Function} next callback
 * @returns {Promise} returns result of executed `down` migration
 */
exports.down = function (next) {
  return migrate.readFile('{down}');
};
