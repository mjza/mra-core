const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../utils/validations');

/**
 * @swagger
 * components:
 *   schemas:
 *     Authorization:
 *       type: object
 *       required:
 *         - dom
 *         - obj
 *         - act
 *       properties:
 *         dom:
 *           type: string
 *           description: The domain (e.g., customer ID) within which the action is being attempted
 *         obj:
 *           type: string
 *           description: The object or resource the user is trying to access
 *         act:
 *           type: string
 *           description: The action the user is trying to perform on the object
 */
async function authorize(req, res, next) {
    // Extract dom, obj, and act directly from the request body
    const { dom, obj, act } = req.body;

    // Extract the subject from the authenticated user information
    // The `req.user` contains sufficient info to identify the subject, like a username or userId
    const sub = req.user.username;

    // Extract the Casbin enforcer from req
    const enforcer = req.enforcer;
    // Perform the authorization check with Casbin
    // This assumes you have access to the Casbin enforcer instance (`enforcer`) here
    const authorized = await enforcer.enforce(sub, dom, obj, act);

    if (!authorized) {
        return res.status(403).json({ message: 'User is not authorized.' });
    }
    next();
}

/**
 * @swagger
 * /v1/authorize:
 *   post:
 *     summary: Authorize a user action on a resource
 *     tags: [Authorization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Authorization'
 *     responses:
 *       200:
 *         description: Authorized successfully
 *         content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: User is authorized.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.post('/authorize', authenticateToken, authorize, (req, res) => {    
    res.json({ message: 'User is authorized.' });
});

module.exports = router;