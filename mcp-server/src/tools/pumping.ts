import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse } from '../utils';
import descriptions from '../descriptions.json';

export const pumpingTools: ToolDefinition[] = [
  {
    name: 'get_pumping',
    description: descriptions.get_pumping.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_pumping.params.from),
      to: z.string().optional().describe(descriptions.get_pumping.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/pumping${query}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'get_latest_pumping',
    description: descriptions.get_latest_pumping.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('GET', '/api/pumping/latest');
      return jsonResponse(res);
    },
  },
  {
    name: 'log_pumping',
    description: descriptions.log_pumping.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('POST', '/api/pumping');
      return jsonResponse(res);
    },
  },
];
