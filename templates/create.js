const migrate = require('oracle-migrate');

/**
 * Migrates database up
 */
exports.up = function () {
  return migrate.readFile('{up}');
};

/**
 * Migrates database down
 */
exports.down = function () {
  return migrate.readFile('{down}');
};
