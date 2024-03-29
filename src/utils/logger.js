const db = require('./database');
const { convertRequestData } = require('./converters');

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
        const res = await db.insertAuditLog(log);
        return res.log_id;
    } catch(err) {
        console.error(err);
        return 0;
    }
};

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
        if (isNaN(req.logId) || req.logId <= 0){
            return null;
        }
        const user = req.user;
        const log = { logId: req.logId, userId: (user ? user.userId : null), comments: typeof comments === 'string' ? comments : JSON.stringify(comments, Object.getOwnPropertyNames(comments), 4) };
        const res = await db.updateAuditLog(log);
        return res.comments;
    } catch(err) {
        console.error(err);
        return null;
    }
};



module.exports = { createEventLog, updateEventLog };