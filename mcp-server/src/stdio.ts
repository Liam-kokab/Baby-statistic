import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { allTools } from './tools';

const server = new Server(
  { name: 'baby-statistic-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// List all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
  })),
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = allTools.find((t) => t.name === name);

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  return tool.handler(args ?? {});
});

const transport = new StdioServerTransport();
server.connect(transport);

