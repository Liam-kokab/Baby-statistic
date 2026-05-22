import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse, formatOsloLocal } from '../utils';
import descriptions from '../descriptions.json';

export const sleepTools: ToolDefinition[] = [
  {
    name: 'get_sleep',
    description: descriptions.get_sleep.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_sleep.params.from),
      to: z.string().optional().describe(descriptions.get_sleep.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/sleep${query}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'get_latest_sleep',
    description: descriptions.get_latest_sleep.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('GET', '/api/sleep/latest');
      return jsonResponse(res);
    },
  },
  {
    name: 'start_sleep',
    description: descriptions.start_sleep.description,
    inputSchema: z.object({}),
    handler: async () => {
      const start = formatOsloLocal(new Date());
      const res = await apiCall('POST', '/api/sleep', { start, end: null });
      return jsonResponse(res);
    },
  },
  {
    name: 'end_sleep',
    description: descriptions.end_sleep.description,
    inputSchema: z.object({}),
    handler: async () => {
      // Get the latest sleep record, then set its end time
      const latestRes = await apiCall('GET', '/api/sleep/latest');
      const latest = latestRes.data as { id?: number; end?: string | null } | null;

      if (!latest?.id) {
        return {
          content: [{ type: 'text' as const, text: 'No active sleep record found.' }],
          isError: true,
        };
      }

      if (latest.end !== null) {
        return {
          content: [{ type: 'text' as const, text: 'The latest sleep record is already ended.' }],
          isError: true,
        };
      }

      const end = formatOsloLocal(new Date());
      const res = await apiCall('PUT', `/api/sleep/${latest.id}`, { end });
      return jsonResponse(res);
    },
  },
];
