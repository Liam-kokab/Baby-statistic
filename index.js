require('./dist/index.js');

process.env.MCP_MODE = 'sse';
require('./dist/mcp-server/index.js');


