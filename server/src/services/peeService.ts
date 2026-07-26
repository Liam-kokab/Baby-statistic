import type { TPee } from 'baby-statistic-common';
import { peeRepository } from '../repositories/peeRepository';
import { createSimpleEventService } from './simpleEventServiceFactory';

export const peeService = createSimpleEventService<TPee>(peeRepository);
