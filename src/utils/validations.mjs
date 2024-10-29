import axios from 'axios';
import { validationResult } from 'express-validator';
import { Agent } from 'https';
import { createEventLog, updateEventLog } from './logger.mjs';

/**
 * Tests if a given URL is accessible by making a HEAD request.
 *
 * @async
 * @param {string} url - The URL to test for accessibility.
 * @returns {Promise<boolean>} True if the URL is accessible, false otherwise.
 */
const testUrlAccessibility = async function (url) {
    try {
        // Create a new instance of the HTTPS agent with keepAlive set to false
        const httpsAgent = new Agent({ keepAlive: false });
        // Use axios to make a HEAD request to the URL
        await axios.head(url, { httpsAgent });
        return true; // URL is accessible
    } catch (err) {
        return false; // URL is not accessible
    }
};

/**
 * Validates whether the given input is a well-formed URL.
 *
 * @param {string} inputUrl - The URL to validate.
 * @returns {boolean} True if the input is a valid URL, false otherwise.
 */
const isValidUrl = (inputUrl) => {
    try {
        const parsedUrl = new URL(inputUrl);
        return true;
    } catch (err) {
        return false;
    }
};

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
const authorizeUser = (extraData) => async (req, res, next) => {
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
const isUserAuthorized = async (extraData, req) => {
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

/**
 * Middleware to validate request data using validationResult.
 * It checks if the request meets the validation criteria set by previous validation middlewares.
 * If the validation fails, it sends a 400 status code with the validation errors.
 * Otherwise, it passes control to the next middleware function in the stack.
 *
 * @param {object} req - The request object from Express.js containing the client's request data.
 * @param {object} res - The response object from Express.js used to send back the desired HTTP response.
 * @param {function} next - The callback function to pass control to the next middleware function.
 */
const checkRequestValidity = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

/**
 * Middleware to handle and respond to invalid JSON format errors.
 * This middleware captures `SyntaxError` thrown by the `express.json()` middleware
 * when the incoming request contains invalid JSON. It extracts useful information
 * about the error, including the error type, message, and position where the error
 * occurred in the JSON string, and sends a detailed response back to the client.
 *
 * @param {object} err - The error object thrown by `express.json()` when it encounters malformed JSON.
 * @param {object} req - The request object from Express.js containing the client's request data.
 * @param {object} res - The response object from Express.js used to send back the desired HTTP response.
 * @param {function} next - The callback function to pass control to the next middleware function.
 *
 * @returns {void|object} - Sends a 400 error response with details if the error is a `SyntaxError`.
 *                          Otherwise, passes control to the next middleware.
 *
 * @example
 * // Usage as part of the Express middleware stack:
 * app.use(express.json());
 * app.use(checkJSONBody);
 */
const checkJSONBody = (err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        // Extract relevant details from the error message
        const position = err.message.match(/position (\d+)/)?.[1] || req.t('Unknown.');
        const errorSnippet = err.message.split('\n')[0]; // Get first line of the error

        return res.status(400).json({
            message: req.t('Invalid JSON format.'),
            details: {
                type: err.type,
                error: errorSnippet,  // Include the main error message
                position: position,  // Provide position of the error in the JSON string
                hint: req.t('Ensure that all keys and values are properly enclosed in double quotes.')
            }
        });
    }
    next();
};

export { authorizeUser, checkJSONBody, checkRequestValidity, isUserAuthorized, isValidUrl, testUrlAccessibility };
