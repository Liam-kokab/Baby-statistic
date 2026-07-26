import { poopService } from '../services/poopService';
import { createSimpleEventRouter } from './simpleEventRouterFactory';

export default createSimpleEventRouter(poopService);
