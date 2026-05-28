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
  {
    name: 'get_current_prediction',
    description: descriptions.get_current_prediction.description,
    inputSchema: z.object({}),
    handler: async () => {
      const res = await apiCall('GET', '/api/drank-milk/suggested');
      return jsonResponse(res);
    },
  },
  {
    name: 'get_prediction_logs',
    description: descriptions.get_prediction_logs.description,
    inputSchema: z.object({
      from: z.string().optional().describe(descriptions.get_prediction_logs.params.from),
      to: z.string().optional().describe(descriptions.get_prediction_logs.params.to),
    }),
    handler: async (args: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (args.from) params.set('from', args.from as string);
      if (args.to) params.set('to', args.to as string);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiCall('GET', `/api/predictions${query}`);
      if (res.status >= 400) return jsonResponse(res);

      // Validate base prediction entries using a zod schema, then enrich with actualAmount
      const base = res.data as unknown;
      const PredSchema = z.object({
        id: z.number(),
        predictedAmount: z.number(),
        actualId: z.number(),
        createdAt: z.string(),
        rawPrediction: z.number().nullable().optional(),
        observedMax: z.number().nullable().optional(),
        recencyFactor: z.number().nullable().optional(),
        roundingStep: z.number().nullable().optional(),
      });
      const BaseArray = z.array(PredSchema);
      let preds: z.infer<typeof BaseArray>;
      try {
        preds = BaseArray.parse(base);
      } catch (e) {
        // If parsing fails, return raw response for debugging
        return jsonResponse({ status: 200, data: res.data });
      }

      if (preds.length === 0) return jsonResponse({ status: 200, data: preds });

      // Determine time window from predictions to fetch the actual drank_milk rows in one call
      const times = preds.map(p => new Date(p.createdAt).toISOString());
      const min = times.reduce((a, b) => (a < b ? a : b));
      const max = times.reduce((a, b) => (a > b ? a : b));
      const drinksRes = await apiCall('GET', `/api/drank-milk?from=${encodeURIComponent(min)}&to=${encodeURIComponent(max)}`);
      let drinks: Array<{ id: number; amount: number }> = [];
      if (drinksRes.status >= 400) {
        // If we couldn't fetch drinks, return predictions without enrichment
        return jsonResponse({ status: 200, data: preds });
      }
      drinks = drinksRes.data as Array<{ id: number; amount: number }>;
      const drankById = new Map<number, { id: number; amount: number }>(drinks.map(d => [d.id, d]));

      const enriched = preds.map(p => ({
        ...p,
        actualAmount: drankById.get(p.actualId)?.amount ?? null,
      }));

      // Validate enriched output
      const OutSchema = z.array(PredSchema.extend({ actualAmount: z.number().nullable() }));
      try {
        OutSchema.parse(enriched);
      } catch (_e) {
        // Fallback to raw preds if validation fails
        return jsonResponse({ status: 200, data: preds });
      }

      return jsonResponse({ status: 200, data: enriched });
    },
  },
];
