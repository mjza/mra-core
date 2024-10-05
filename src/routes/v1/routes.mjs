import { Router } from 'express';
const router = Router();

import auditLogMiddleware from '../../utils/logger.mjs';
import geoRoutes from './geoRoutes.mjs';
import lookupRoutes from './lookupRoutes.mjs';
import ticketRoutes from './ticketRoutes.mjs';
import userDetailsRoutes from './userDetailsRoutes.mjs';

//To automatically apply the auditLogMiddleware to all routes, We must place the middleware function before any route definitions
router.use(auditLogMiddleware);

router.use(lookupRoutes);
router.use(userDetailsRoutes);
router.use(ticketRoutes);
router.use(geoRoutes);

export default router;

/**
 * @swagger
 * components:
 *   responses:
 *     ServerInternalError:
 *       description: Internal server error.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: different exception messages in server processing.
 *     Forbidden:
 *       description: Forbidden
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: User is not authorized.
 */