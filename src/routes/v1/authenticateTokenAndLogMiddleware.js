const axios = require('axios');
const db = require('../../utils/database');


/**
 * Extracts key information from the Express request object and returns it as a JSON string.
 * Handles circular references in the object structure to ensure proper JSON serialization.
 * 
 * @param {object} req - The Express request object.
 * @returns {string} A JSON string representing key information from the request object.
 *
 * @example
 * app.use((req, res, next) => {
 *   const requestData = extractRequestData(req);
 *   console.log(requestData); // Logs serialized request data
 *   next();
 * });
 * 
 * The function selectively extracts data such as HTTP method, URL, headers, body, query parameters,
 * IP address, and more. It's designed to be used in middleware for logging or auditing purposes.
 * Note: Ensure that any middleware required for populating these fields (like body-parser for `req.body`, 
 * or cookie-parser for `req.cookies`) is set up in your Express application.
 */
function convertRequestData(req) {
    // Array of properties to hide
    const forbiddenProperties = ['password', 'token', 'firstName', 'middleName', 'lastName', 'dateOfBirth', 'profilePictureUrl', 'profilePictureThumbnailUrl'];

    const requestData = {
        method: req.method,
        url: req.originalUrl,
        headers: hideSensitiveData(req.headers, ['Authorization']),
        body: hideSensitiveData(req.body, forbiddenProperties),
        query: hideSensitiveData(req.query, forbiddenProperties),
        params: hideSensitiveData(req.params, forbiddenProperties),
        ip: req.ip,
        hostname: req.hostname,
        protocol: req.protocol,
        path: req.path,
        cookies: hideSensitiveData(req.cookies, forbiddenProperties)
    };

    // The getCircularReplacer function is designed to be used with JSON.stringify to avoid 
    // TypeError when attempting to convert a JavaScript object with circular references into 
    // a JSON string. Circular references occur when an object references itself or when there 
    // are multiple objects that reference each other, creating a loop. 
    // JSON.stringify cannot directly serialize objects with circular references because it 
    // would result in an infinite loop.
    const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return;
                }
                seen.add(value);
            }
            return value;
        };
    };

    return JSON.stringify(requestData, getCircularReplacer(), 4);
}

/**
 * Hides sensitive data within an object by masking specified properties. This function
 * iterates through each property of the provided object. If a property's name matches
 * any of the given forbidden properties (case-insensitive), its value is replaced with
 * a mask ('****'). Properties not listed as forbidden are left unchanged.
 *
 * This function is non-destructive; it returns a new object with the modified values
 * while leaving the original object intact.
 *
 * @param {Object} obj - The object containing potential sensitive data to be masked.
 * @param {Array<string>} forbiddenProperties - An array of property names (strings)
 *                   that, if found in the object, should have their values masked.
 *                   Matching is case-insensitive.
 * @returns {Object} A new object with sensitive data masked. If the input is not an
 *                   object, the input is returned unchanged.
 *
 * @example
 * const user = {
 *   name: 'John Doe',
 *   email: 'john.doe@example.com',
 *   password: 'supersecret',
 * };
 *
 * const maskedUser = hideSensitiveData(user, ['password']);
 * console.log(maskedUser);
 * // Output:
 * // {
 * //   name: 'John Doe',
 * //   email: 'john.doe@example.com',
 * //   password: '****',
 * // }
 */
function hideSensitiveData(obj, forbiddenProperties) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const newObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (forbiddenProperties.some(prop => key.toLowerCase().includes(prop.toLowerCase()))) {
                newObj[key] = '****';
            } else {
                newObj[key] = obj[key];
            }
        }
    }

    return newObj;
}

/**
 * Creates an event log entry in the database based on the incoming request and user ID.
 * This function gathers essential information from the request, such as the HTTP method, route,
 * IP address, and user ID, and logs these details into the database. It is primarily used
 * for audit purposes, tracking the requests made to the server along with the authenticated
 * user making the request.
 * 
 * @param {Object} req - The Express request object. It provides access to the request's
 *                       method, URL, headers, and IP address.
 * @param {number|string} userId - The ID of the user making the request. This should be
 *                                 extracted from the authenticated user's information
 *                                 previously set in the request object.
 * @returns {Promise<number>} A promise that resolves to the ID of the created log entry
 *                            in the database. If the function encounters an error during
 *                            execution, it resolves to 0.
 * 
 * @async
 * @example
 * // Example of using createEventLog within an Express middleware
 * const auditLogMiddleware = async (req, res, next) => {
 *     const userId = req.user.userId; // Assuming userId is already set on req.user
 *     const logId = await createEventLog(req, userId);
 *     if (logId !== 0) {
 *         console.log(`Audit log created with ID: ${logId}`);
 *     } else {
 *         console.error('Failed to create audit log.');
 *     }
 *     next();
 * };
 */
const createEventLog = async (req, userId) => {
    try {
        const methodRoute = req.method + ":" + (req.headers.path ? req.headers.path : req.url);
        const reqJson = convertRequestData(req);
        const ipAddress = req.ip || req.connection.remoteAddress;
        const log = { methodRoute, req: reqJson, ipAddress, userId };
        const res = await db.insertAuditLog(log);
        return res.log_id;
    } catch(err) {
        console.error(err);
        return 0;
    }
};

/**
 * Records an error log in the database for a specific request.
 * Useful for tracking errors that occur during the request lifecycle.
 *
 * @param {object} req - The Express request object.
 * @param {string} comments - Additional comments or error information.
 * @returns {string|null} The updated comments of the log entry, or null in case of failure.
 */
const recordErrorLog = async (req, comments) => {
    try {
        if (isNaN(req.logId) || req.logId <= 0){
            return null;
        }
        const log = { logId: req.logId, comments: typeof comments === 'string' ? comments : JSON.stringify(comments, Object.getOwnPropertyNames(comments), 4) };
        const res = await db.updateAuditLog(log);
        return res.comments;
    } catch(err) {
        console.error(err);
        return null;
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
 * Middleware to check if a JWT token present in the request header.
 * Sends a 401 response if the token is not provided or invalid, respectively.
 *
 * @param {Object} req - The request object from Express.js.
 * @param {Object} res - The response object from Express.js.
 * @param {function} next - The next middleware function in the Express.js route.
 */
const authenticateTokenAndLogMiddleware = async (req, res, next) => {
    // Get the token from the request header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {// If no token is provided
        await createEventLog(req, null);
        return res.status(401).json({ message: 'You must provide a valid JWT token.' });
    }

    try {
        const response = await axios.post(process.env.AUTHENTICATION_SERVICE_URL, {}, {
            headers: {
                Authorization: authHeader
            }
        });
        const { userId, username, email } = response.data;  
        req.user = { userId, username, email };

        // Perform audit logging
        const logId = await createEventLog(req, userId);
        req.logId = logId;
        next();
    } catch (error) {
        if (error.response) {
            // Relay the entire response from the external service
            return res.status(error.response.status).json(error.response.data);
        }
        // Default to a 500 status code if no specific response is available
        return res.sendStatus(500);
    }
};

module.exports = { authenticateTokenAndLogMiddleware, recordErrorLog };