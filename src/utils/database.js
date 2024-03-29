const { MraAuditLogsCore, closeSequelize, Sequelize } = require('../models');

/**
 * Inserts a new audit log into the database.
 *
 * @param {Object} log - The log object { methodRoute, req, comments, ipAddress, userId } containing methodRoute, req, comment, ipAddress, and userId.
 * @returns {Object} The inserted log object.
 */
const insertAuditLog = async (log) => {
  const { methodRoute, req, comments, ipAddress, userId } = log;
  const insertedLog = await MraAuditLogsCore.create({
    method_route: methodRoute,
    req,
    ip_address: ipAddress,
    comments: comments || '',
    user_id: userId,
  });
  return insertedLog && insertedLog.get({ plain: true });;
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
  const [updateCount, updatedLogs] = await MraAuditLogsCore.update({
    comments: comments,
  }, {
    where: {
      log_id: logId
    },
    returning: true,
  });

  return updateCount === 0 ? null : updatedLogs[0];
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

  const deleteCount = await MraAuditLogsCore.destroy({
    where: {
      method_route: {
        [Sequelize.Op.like]: 'TEST %',
      },
      log_id: logId
    }
  });
  return { success: deleteCount > 0 };
};



/**
 * Closes the database connection pool.
 */
const closeDBConnections = async () => {
  await closeSequelize();
};


module.exports = {
  insertAuditLog,
  updateAuditLog,
  deleteAuditLog,
  closeDBConnections
};
