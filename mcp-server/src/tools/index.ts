import { timeTools } from './time';
import { drankMilkTools } from './drankMilk';
import { sleepTools } from './sleep';
import { peeTools } from './pee';
import { poopTools } from './poop';
import { medicineTools } from './medicine';
import { pumpingTools } from './pumping';
import { backupTools } from './backup';
import type { ToolDefinition } from '../types';

export const allTools: ToolDefinition[] = [
  ...timeTools,
  ...drankMilkTools,
  ...sleepTools,
  ...peeTools,
  ...poopTools,
  ...medicineTools,
  ...pumpingTools,
  ...backupTools,
];
