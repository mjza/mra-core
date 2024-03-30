const express = require('express');
const router = express.Router();

const { auditLogMiddleware } = require('./auditLogMiddleware');
const userDetailsRoutes = require('./userDetailsRoutes');

//To automatically apply the auditLogMiddleware to all routes, We must place the middleware function before any route definitions
router.use(auditLogMiddleware);

router.use(userDetailsRoutes);


module.exports = router;

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