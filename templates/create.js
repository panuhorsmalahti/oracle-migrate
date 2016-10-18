const migrate = require('oracle-migrate');

exports.up = function () {
  return migrate.readFile('{up}');
};

exports.down = function () {
  return migrate.readFile('{down}');
};
