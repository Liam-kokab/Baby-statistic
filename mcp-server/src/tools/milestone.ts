import { z } from 'zod';
import { apiCall } from '../apiClient';
import type { ToolDefinition } from '../types';
import { jsonResponse } from '../utils';
import descriptions from '../descriptions.json';

export const milestoneTools: ToolDefinition[] = [
  {
    name: 'get_milestones',
    description: descriptions.get_milestones.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_milestones.params.from),
      to: z.string().optional().describe(descriptions.get_milestones.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/milestones${query}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'get_milestone',
    description: descriptions.get_milestone.description,
    inputSchema: z.object({
      id: z.number().describe(descriptions.get_milestone.params.id),
    }),
    handler: async (args: Record<string, unknown>) => {
      const res = await apiCall('GET', `/api/milestones/${args.id as number}`);
      return jsonResponse(res);
    },
  },
  {
    name: 'create_milestone',
    description: descriptions.create_milestone.description,
    inputSchema: z.object({
      title: z.string().describe(descriptions.create_milestone.params.title),
      description: z.string().optional().describe(descriptions.create_milestone.params.description),
      occurredAt: z.string().optional().describe(descriptions.create_milestone.params.occurredAt),
    }),
    handler: async (args: Record<string, unknown>) => {
      const res = await apiCall('POST', '/api/milestones', {
        title: args.title,
        description: args.description ?? null,
        occurredAt: args.occurredAt,
      });
      return jsonResponse(res);
    },
  },
  {
    name: 'update_milestone',
    description: descriptions.update_milestone.description,
    inputSchema: z.object({
      id: z.number().describe(descriptions.update_milestone.params.id),
      title: z.string().optional().describe(descriptions.update_milestone.params.title),
      description: z.string().nullable().optional().describe(descriptions.update_milestone.params.description),
      occurredAt: z.string().optional().describe(descriptions.update_milestone.params.occurredAt),
    }),
    handler: async (args: Record<string, unknown>) => {
      const { id, ...body } = args;
      const res = await apiCall('PUT', `/api/milestones/${id as number}`, body);
      return jsonResponse(res);
    },
  },
  {
    name: 'delete_milestone',
    description: descriptions.delete_milestone.description,
    inputSchema: z.object({
      id: z.number().describe(descriptions.delete_milestone.params.id),
    }),
    handler: async (args: Record<string, unknown>) => {
      const res = await apiCall('DELETE', `/api/milestones/${args.id as number}`);
      return jsonResponse(res);
    },
  },
];

