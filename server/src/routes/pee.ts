import { peeService } from '../services/peeService';
import { createSimpleEventRouter } from './simpleEventRouterFactory';

export default createSimpleEventRouter(peeService);
