import { convertRequestData } from './converters.mjs';
import { insertAuditLog, updateAuditLog } from './database.mjs';

/**
 * Creates an event log entry in the database based on the incoming request and user ID.
 * This function gathers essential information from the request, such as the HTTP method, route,
 * IP address, and user ID, and logs these details into the database. It is primarily used
 * for audit purposes, tracking the requests made to the server along with the authenticated
 * user making the request.
 * 
 * @param {Object} req - The Express request object. It provides access to the request's
 *                       method, URL, headers, and IP address.
 * @returns {Promise<number>} A promise that resolves to the ID of the created log entry
 *                            in the database. If the function encounters an error during
 *                            execution, it resolves to 0.
 * 
 * @async
 */
const createEventLog = async (req, userId) => {
    try {
        const methodRoute = req.method + ":" + (req.headers.path ? req.headers.path : req.url);
        const reqJson = convertRequestData(req);
        const ipAddress = req.ip || req.connection.remoteAddress;
        const user = req.user;
        const log = { methodRoute, req: reqJson, ipAddress, userId: (user ? user.userId : userId) };
        const res = await insertAuditLog(log);
        return res.log_id;
    } catch (err) {
        console.error(err);
        return 0;
    }
};

export { createEventLog };

/**
 * Records an error or an extra log in the database for a specific request.
 * Useful for tracking errors that occur during the request lifecycle.
 *
 * @param {object} req - The Express request object.
 * @param {string} comments - Additional comments or error information.
 * @returns {string|null} The updated comments of the log entry, or null in case of failure.
 */
const updateEventLog = async (req, comments) => {
    try {
        if (isNaN(req.logId) || req.logId <= 0) {
            return null;
        }
        const user = req.user;
        const log = { logId: req.logId, userId: (user ? user.userId : null), comments: typeof comments === 'string' ? comments : JSON.stringify(comments, Object.getOwnPropertyNames(comments), 4) };
        const res = await updateAuditLog(log);
        return res.comments;
    } catch (err) {
        console.error(err);
        return null;
    }
};

export { updateEventLog };

/**
 * Middleware function to create an audit log for each request.
 * Captures request details and logs them into the database.
 * Adds a 'logId' property to the request object for further reference in the request lifecycle.
 *
 * @param {object} req - The Express request object.
 * @param {object} _ - The Express response object.
 * @param {function} next - The next middleware function in the Express stack.
 */
const auditLogMiddleware = async (req, _, next) => {
    try {
        const logId = await createEventLog(req);
        req.logId = logId;
        next();
    } catch (err) {
        console.error(err);
        next();
    }
};

// Default export for auditLogMiddleware
export default auditLogMiddleware;
