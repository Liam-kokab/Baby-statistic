import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse, formatOsloLocal } from '../utils';
import descriptions from '../descriptions.json';

export const medicineTools: ToolDefinition[] = [
  {
    name: 'get_medicines',
    description: descriptions.get_medicines.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('GET', '/api/medicine');
      return jsonResponse(res);
    },
  },
  {
    name: 'log_medicine_dose',
    description: descriptions.log_medicine_dose.description,
    inputSchema: z.object({
      id: z.number().describe(descriptions.log_medicine_dose.params.id),
      takenAt: z.string().optional().describe(descriptions.log_medicine_dose.params.takenAt),
    }),
    handler: async (args: Record<string, unknown>) => {
      const takenAt = (args.takenAt as string) ?? formatOsloLocal(new Date());
      const res = await apiCall('POST', `/api/medicine/${args.id}/log`, { takenAt });
      return jsonResponse(res);
    },
  },
];
