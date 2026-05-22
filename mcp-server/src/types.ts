import type { z } from 'zod';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

