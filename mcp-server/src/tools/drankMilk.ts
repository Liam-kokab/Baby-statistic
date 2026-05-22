import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse } from '../utils';
import descriptions from '../descriptions.json';

export const drankMilkTools: ToolDefinition[] = [
  {
    name: 'get_drank_milk',
    description: descriptions.get_drank_milk.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_drank_milk.params.from),
      to: z.string().optional().describe(descriptions.get_drank_milk.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/drank-milk${query}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'create_drank_milk',
    description: descriptions.create_drank_milk.description,
    inputSchema: z.object({
      amount: z.number().describe(descriptions.create_drank_milk.params.amount),
      source: z.enum(['FRIDGE', 'BOOB']).optional().describe(descriptions.create_drank_milk.params.source),
      isNewBottle: z.boolean().describe(descriptions.create_drank_milk.params.isNewBottle),
    }),
    handler: async (args: Record<string, unknown>) => {
      const source = (args.source as string) ?? 'FRIDGE';
      const isNewBottle = args.isNewBottle as boolean;
      const res = await apiCall('POST', '/api/drank-milk', { amount: args.amount, source, isNewBottle });
      return jsonResponse(res);
    },
  },
  {
    name: 'log_milk_waste',
    description: descriptions.log_milk_waste.description,
    inputSchema: z.object({
      amount: z.number().describe(descriptions.log_milk_waste.params.amount),
    }),
    handler: async (args: Record<string, unknown>) => {
      const res = await apiCall('POST', '/api/drank-milk/waste', { amount: args.amount });
      return jsonResponse(res);
    },
  },
];
