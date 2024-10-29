import axios from 'axios';
import { createEventLog, updateEventLog } from './logger.mjs';

/**
 * @swagger
 * components:
 *   responses:
 *     UnauthorizedAccessInvalidTokenProvided:
 *       description: Unauthorized access - No token provided.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: You must provide a valid JWT token.
 */
/**
 * Middleware function for Express that authorizes a user based on provided extra data and the incoming request.
 * It attempts to authorize the user and on success, updates the request object with user details, roles, and conditions.
 * It also manages logging of the event, whether it is a new event or an update to an existing one.
 *
 * @param {Object} extraData - Data necessary for the authorization process such as domain, object, action, and attributes.
 *                             This is used to determine the context in which the user is attempting to operate.
 *
 * @param {Object} req - The request object from Express.js.
 * @param {Object} res - The response object from Express.js.
 * @returns {Function} Returns an asynchronous middleware function which takes Express `req`, `res`, and `next` parameters.
 */
export const authorizeUser = (extraData) => async (req, res, next) => {
    try {
        const response = await isUserAuthorized(extraData, req);

        const { user, roles, conditions } = response.data;
        if (!req.logId) {
            const logId = await createEventLog(req, user.userId);
            req.logId = logId;
            req.user = user;
            req.roles = roles;
            req.conditions = conditions;
        } else {
            req.user = user;
            req.roles = roles;
            req.conditions = conditions;
            await updateEventLog(req, { success: 'User has been authorized.', details: response.data });
        }
        next();
    } catch (error) {
        await updateEventLog(req, { error: 'Error in authorize user.', details: error });
        if (error.response) {
            // Relay the entire response from the external service
            return res.status(error.response.status).json(error.response.data);
        }
        // Default to a 500 status code if no specific response is available
        return res.sendStatus(500);
    }
};

/**
 * Asynchronously determines if a user is authorized to perform an action on an object within a domain, using specified attributes, based on the provided request details and extra data.
 *
 * @async
 * @param {Object} extraData - An object containing the necessary data for authorization:
 *                             `dom` (string) - The domain in which the authorization is to be checked,
 *                             `obj` (string) - The object the action is to be performed on,
 *                             `act` (string) - The action to be authorized,
 *                             `attrs` (Object) - Additional attributes that may be required for authorization.
 * @param {Object} req - The HTTP request object from which the authorization header is extracted.
 * @returns {Promise<Object>} A Promise that resolves to the response from the authorization server.
 * @throws {Error} Throws an error if the request to the authorization server fails.
 *
 */
export const isUserAuthorized = async (extraData, req) => {
    try {
        const body = {
            dom: extraData.dom,
            obj: extraData.obj,
            act: extraData.act,
            attrs: extraData.attrs ?? {}
        };

        const serviceUrl = process.env.AUTH_SERVER_URL + '/v1/authorize';

        const authHeader = req.headers['authorization'];

        const response = await axios.post(serviceUrl, body, {
            headers: {
                Authorization: authHeader
            }
        });

        return response;
    } catch (error) {
        throw error;
    }
};
