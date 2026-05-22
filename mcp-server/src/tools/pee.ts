import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse } from '../utils';
import descriptions from '../descriptions.json';

export const peeTools: ToolDefinition[] = [
  {
    name: 'get_pee',
    description: descriptions.get_pee.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_pee.params.from),
      to: z.string().optional().describe(descriptions.get_pee.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/pee${query}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'log_pee',
    description: descriptions.log_pee.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('POST', '/api/pee');
      return jsonResponse(res);
    },
  },
];
