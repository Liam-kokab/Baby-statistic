import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse } from '../utils';
import descriptions from '../descriptions.json';

export const poopTools: ToolDefinition[] = [
  {
    name: 'get_poop',
    description: descriptions.get_poop.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_poop.params.from),
      to: z.string().optional().describe(descriptions.get_poop.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/poop${query}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'log_poop',
    description: descriptions.log_poop.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('POST', '/api/poop');
      return jsonResponse(res);
    },
  },
];
