const { Pool } = require('pg');

// Use environment variables to configure the database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.NODE_ENV === 'development' ? false : {
    rejectUnauthorized: false
  }
});

const logsTable = process.env.LOGS_TABLE;
const usersTable = process.env.USERS_TABLE;

/**
 * Inserts a new audit log into the database.
 *
 * @param {Object} log - The log object { methodRoute, req, comments, ipAddress, userId } containing methodRoute, req, comment, ipAddress, and userId.
 * @returns {Object} The inserted log object.
 */
const insertAuditLog = async (log) => {
  const { methodRoute, req, comments, ipAddress, userId } = log;
  const query = `INSERT INTO ${logsTable} (method_route, req, ip_address, comments, user_id) VALUES ($1, $2, $3, COALESCE($4, ''), $5) RETURNING *`;
  const { rows } = await pool.query(query, [methodRoute, req, ipAddress, comments, userId]);
  return rows[0];
};

/**
 * Updates an existing audit log in the database.
 *
 * @param {Object} log - The log object { logId, comments } containing logId, methodRoute, req, comment, ipAddress, and userId.
 * @returns {Object} The updated log object.
 */
const updateAuditLog = async (log) => {
  const { logId, comments } = log;
  if (isNaN(logId))
    return null;
  const query = `UPDATE ${logsTable} SET comments = $1 WHERE log_id = $2 RETURNING log_id, comments`;
  const { rows } = await pool.query(query, [comments, logId]);
  return rows[0];
};

/**
 * Deletes a test audit log from the database.
 *
 * @param {number} logId - The ID of the log to be deleted.
 * @returns {Object} An object indicating the success of the deletion.
 */
const deleteAuditLog = async (logId) => {
  if (isNaN(logId))
    return { success: false };
  const query = `DELETE FROM ${logsTable} WHERE method_route LIKE 'TEST %' AND log_id = $1`;
  const result = await pool.query(query, [logId]);
  return { success: result.rowCount > 0 };
};


/**
 * Closes the database connection pool.
 */
const closePool = async () => {
  await pool.end();
};

module.exports = {
  insertAuditLog,
  updateAuditLog,
  deleteAuditLog,
  closePool
};
