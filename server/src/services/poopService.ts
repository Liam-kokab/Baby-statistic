import type { TPoop } from 'baby-statistic-common';
import { poopRepository } from '../repositories/poopRepository';
import { createSimpleEventService } from './simpleEventServiceFactory';

export const poopService = createSimpleEventService<TPoop>(poopRepository);
