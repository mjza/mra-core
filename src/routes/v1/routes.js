const express = require('express');
const router = express.Router();

const authorizationRoute = require('./authorizationRoute');

router.use(authorizationRoute);

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