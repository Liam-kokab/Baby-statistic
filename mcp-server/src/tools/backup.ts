import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse } from '../utils';
import descriptions from '../descriptions.json';

export const backupTools: ToolDefinition[] = [
  {
    name: 'get_all_data',
    description: descriptions.get_all_data.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('GET', '/api/backup');
      return jsonResponse(res);
    },
  },
];

