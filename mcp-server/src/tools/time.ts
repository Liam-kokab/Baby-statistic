import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { formatOsloLocal } from '../utils';
import descriptions from '../descriptions.json';

const getMcpBuildTime = (): string => {
  const filePath = path.join(__dirname, 'buildTime.json');
  if (!fs.existsSync(filePath)) return 'unknown';
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { buildTime: string };
  return data.buildTime;
};

export const timeTools: ToolDefinition[] = [
  {
    name: 'get_current_time',
    description: descriptions.get_current_time.description,
    inputSchema: z.object({}),
    handler: async () => {
      const now = new Date();
      const oslo = formatOsloLocal(now);
      return {
        content: [
          {
            type: 'text' as const,
            text: oslo,
          },
        ],
      };
    },
  },
  {
    name: 'get_mcp_build_time',
    description: descriptions.get_mcp_build_time.description,
    inputSchema: z.object({}),
    handler: async () => {
      return {
        content: [
          {
            type: 'text' as const,
            text: getMcpBuildTime(),
          },
        ],
      };
    },
  },
];
