import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { formatOsloLocal } from '../utils';
import descriptions from '../descriptions.json';

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
];
