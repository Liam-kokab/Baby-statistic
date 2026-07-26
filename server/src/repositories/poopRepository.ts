import type { TPoop, TPoopDb } from 'baby-statistic-common';
import { createSimpleEventRepository } from './simpleEventRepositoryFactory';

export const poopRepository = createSimpleEventRepository<TPoopDb, TPoop>('poop');
