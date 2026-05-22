import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { allTools } from './tools';

const app = express();
const PORT = process.env.MCP_PORT ?? 3001;
const mode = process.env.MCP_MODE ?? process.argv[2] ?? 'both'; // 'sse' | 'stdio' | 'both'

const getMcpBuildTime = (): string => {
  const filePath = path.join(__dirname, 'buildTime.json');
  if (!fs.existsSync(filePath)) return 'unknown';
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { buildTime: string };
  return data.buildTime;
};

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>();

const createServer = (): Server => {
  const server = new Server(
    { name: 'baby-statistic-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
    })),
  }));

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

  return server;
};

// --- SSE transport ---
if (mode === 'sse' || mode === 'both') {
  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.set(transport.sessionId, transport);

    res.on('close', () => {
      transports.delete(transport.sessionId);
    });

    const server = createServer();
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(400).json({ error: 'No active SSE connection for this session' });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  app.listen(PORT, () => {
    console.log(`\n🤖 MCP Server (SSE) running on http://localhost:${PORT}`);
    console.log(`   SSE endpoint:      http://localhost:${PORT}/sse`);
    console.log(`   Messages endpoint:  http://localhost:${PORT}/messages`);
    console.log(`   Build time:         ${getMcpBuildTime()}\n`);
  });
}

// --- stdio transport ---
if (mode === 'stdio' || mode === 'both') {
  const stdioServer = createServer();
  const stdioTransport = new StdioServerTransport();
  stdioServer.connect(stdioTransport).then(() => {
    if (mode === 'stdio') {
      console.error('🤖 MCP Server (stdio) connected');
    }
  });
}
