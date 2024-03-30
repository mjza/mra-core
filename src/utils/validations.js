const axios = require('axios');
const { Agent } = require('https');
const { createEventLog, updateEventLog } = require('./logger');

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
 * Middleware to check if a user is authorized to perform a task.
 *
 * @param {Object} req - The request object from Express.js.
 * @param {Object} res - The response object from Express.js.
 * @param {function} next - The next middleware function in the Express.js route.
 */
const authorize = (extraData) => async (req, res, next) => {
    // Get the token from the request header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {// If no token is provided
        return res.status(401).json({ message: 'You must provide a valid JWT token.' });
    }

    try {
        const body = {
            dom: extraData.dom,
            obj: extraData.obj,
            act: extraData.act,
            attrs: extraData.attrs
        };
        
        const serviceUrl = process.env.AUTH_SERVER_URL + '/v1/authorize';

        const response = await axios.post(serviceUrl, body, {
            headers: {
                Authorization: authHeader
            }
        });

        const { user, roles } = response.data;
        if(!req.logId) {
            const logId = await createEventLog(req, user.userId);
            req.logId = logId;
            req.user = user;
            req.roles = roles;
        } else {
            req.user = user;
            req.roles = roles;
            await updateEventLog(req, { success: 'User has been authorized.', details: response.data});
        }
        next();
    } catch (error) {
        await updateEventLog(req, { error: 'Error in authorize user.', details: error});
        if (error.response) {
            // Relay the entire response from the external service
            return res.status(error.response.status).json(error.response.data);
        }
        // Default to a 500 status code if no specific response is available
        return res.sendStatus(500);
    }
};

module.exports = { testUrlAccessibility, isValidUrl, authorize };