const tools = require('./lib/tools');
const libCommands = require('./lib/commands');

module.exports = {
  readFile: tools.readFile,
  tools: tools,
  libCommands: libCommands
};
