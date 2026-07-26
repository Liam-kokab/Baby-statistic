import type { TPee, TPeeDb } from 'baby-statistic-common';
import { createSimpleEventRepository } from './simpleEventRepositoryFactory';

export const peeRepository = createSimpleEventRepository<TPeeDb, TPee>('pee');
