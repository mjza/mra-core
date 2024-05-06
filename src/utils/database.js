const { Sequelize, closeSequelize, MraUsers, MraAuditLogsCore, MraGenderTypes, MraUserDetails, MraTickets, MraCustomers, MraTicketCategories } = require('../models');

/**
 * Closes the database connection pool.
 */
const closeDBConnections = async () => {
  await closeSequelize();
};

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
 * Retrieves user details from the database based on the provided conditions and pagination settings.
 *
 * This function queries the database for user details matching the specified conditions
 * and supports pagination by using a limit and offset. It fetches one additional record beyond the limit
 * to determine the presence of subsequent pages. This additional record is not returned in the results.
 *
 * @param {object} where - The object containing `where` clauses to specify the search criteria.
 * @param {object} pagination - The pagination settings containing 'limit' and 'offset'.
 *                              'limit' defines the number of user details to fetch.
 *                              'offset' specifies the number of user details to skip.
 * @returns {Object[]} An array of user details objects. Each object contains details such as
 *                     user_id, first_name, middle_name, last_name, gender_id, date_of_birth,
 *                     profile_picture_url, profile_picture_thumbnail_url, creator, created_at,
 *                     updator, and updated_at. The length of the array is `limit + 1` if more items
 *                     are available, allowing the caller to determine if additional pages exist.
 */
async function getUserDetails(where, pagination) {
  const { limit, offset } = pagination;
  const userDetails = await MraUserDetails.findAll({
    where,
    limit: limit + 1,
    offset,
    include: [{
      model: MraGenderTypes,
      as: "gender",
      attributes: ['gender_id', 'gender_name'],
    }],
    attributes: ['user_id', 'first_name', 'middle_name', 'last_name', 'gender_id', 'date_of_birth', 'profile_picture_url', 'profile_picture_thumbnail_url', 'creator', 'created_at', 'updator', 'updated_at'],
  });

  return userDetails && userDetails.map(user => user.get({ plain: true }));
}

/**
 * Creates new user details in the database.
 *
 * @param {Object} userDetails - The user details object.
 * @returns {Object} The created user details object.
 */
async function createUserDetails(userDetails) {
  const createdRow = await MraUserDetails.create(userDetails);

  if (createdRow && createdRow.user_id) {
    const userDetails = await getUserDetails({ user_id: createdRow.user_id }, { limit: 0, offset: 0 });
    return userDetails && userDetails[0];
  } else {
    return null;
  }
}

/**
 * Updates user details in the database based on the provided userId and userDetails.
 *
 * @param {object} where - The object contain `where` clauses to specify the search criteria.
 * @param {Object} userDetails - The new user details object.
 * @returns {Object} The updated user details object.
 */
async function updateUserDetails(where, userDetails) {
  const [affectedRowCount] = await MraUserDetails.update(userDetails, { where });

  if (affectedRowCount > 0) {
    const userDetails = await getUserDetails(where, { limit: 0, offset: 0 });
    return userDetails && userDetails[0];
  } else {
    return null;
  }
}

/**
 * Retrieves a user from the database based on the provided userId.
 *
 * @param {integer} userId - The userId of the user to retrieve.
 * @returns {Object|null} The user object if found, null otherwise.
 */
const getUserByUserId = async (userId) => {
  if (isNaN(userId)) {
    return null;
  }
  try {
    const user = await MraUsers.findOne({
      where: { user_id: userId }
    });

    return user && user.get({ plain: true });
  } catch (error) {
    console.error('Error retrieving user by userId:', error);
  }
};

/**
 * Retrieves a user from the database based on the provided username.
 *
 * @param {string} username - The username of the user to retrieve.
 * @returns {Object|null} The user object if found, null otherwise.
 */
const getUserByUsername = async (username) => {
  if (!username || !username.trim()) {
    return null;
  }
  try {
    const user = await MraUsers.findOne({
      where: {
        username: username.trim().toLowerCase()
      }
    });

    return user && user.get({ plain: true });
  } catch (error) {
    console.error('Error retrieving user by username:', error);
  }
};

/**
 * Deletes a user from the database based on the provided username.
 *
 * @param {string} username - The username of the user to be deleted.
 * @returns {Object|null} The deleted user object if successful, null if no user was found or deleted.
 */
const deleteUserByUsername = async (username) => {
  if (!username || !username.trim())
    return null;

  const user = await MraUsers.findOne({
    where: {
      username: username.trim().toLowerCase()
    }
  });
  if (!user) {
    return null;
  }

  await MraUsers.destroy({
    where: {
      username: username.trim().toLowerCase(),
    },
  });

  return user && user.get({ plain: true });
};

/**
 * Activates a user in the database based on the provided user information.
 *
 * @param {Object} user - The user object containing username and activationCode.
 * @returns {boolean} True if the user was successfully activated, false otherwise.
 */
const activateUser = async (user) => {
  const { username, activationCode } = user;
  if (!username || !username.trim() || !activationCode || !activationCode.trim())
    return false;

  // Update the user if the activation code matches and is within the valid timeframe
  const [updateCount] = await MraUsers.update(
    { activation_code: null }, // Set activation_code to NULL
    {
      where: {
        username: username.trim().toLowerCase(),
        activation_code: activationCode.trim(),
        created_at: {
          [Sequelize.Op.gte]: Sequelize.literal("(now() AT TIME ZONE 'UTC') - INTERVAL '5 days'"), // created_at >= 5 days ago
          [Sequelize.Op.lte]: Sequelize.literal("(now() AT TIME ZONE 'UTC')"),   // created_at <= CURRENT_TIMESTAMP
        },
        confirmation_at: null, // confirmation_at IS NULL
      },
      returning: true, // This option is specific to PostgreSQL
    }
  );

  return updateCount > 0; // Returns true if at least one row was updated  
};

/**
 * Retrieves ticket from the database based on the provided conditions.
 *
 * @param {object} where - The object containing `where` clauses to specify the search criteria.
 * @returns {Object[]} An array of ticket objects.
 */
async function getTickets(where) {
  const tickets = await MraTickets.findAll({
    where,
    include: [{
      model: MraCustomers,
      as: 'customer',
      attributes: ['customer_id', 'customer_name'],
    }, {
      model: MraTicketCategories,
      as: 'ticket_category',
      attributes: ['ticket_category_id', 'ticket_category_name'],
    }, {
      model: MraUsers,
      as: 'publisher_mra_user',
      attributes: ['user_id', 'display_name'],
    }, {
      model: MraUsers,
      as: 'creator_mra_user',
      attributes: ['user_id', 'display_name'],
    }, {
      model: MraUsers,
      as: 'updator_mra_user',
      attributes: ['user_id', 'display_name'],
    }],
    attributes: [
      'ticket_id', 'title', 'body', 'is_confidential', 'media_urls',  
      'geo_latitude', 'geo_longitude', 'geo_location',
      'creator', 'created_at', 'updator', 'updated_at', 'publisher', 'published_at', 'closed_at', 'close_reason'
    ],
  });

  return tickets.map(ticket => ({
    ...ticket.get({ plain: true }),
    publisher: ticket.publisher_mra_user ? ticket.publisher_mra_user.get({ plain: true }) : null,
    creator: ticket.creator_mra_user ? ticket.creator_mra_user.get({ plain: true }) : null,
    updator: ticket.updator_mra_user ? ticket.updator_mra_user.get({ plain: true }) : null,
    // This map will ensure we remove the original model association keys
  })).map(({ publisher_mra_user, creator_mra_user, updator_mra_user, ...rest }) => rest);
  
}

/**
* Creates a new ticket in the database.
*
* @param {Object} ticket - The ticket object.
* @returns {Object} The created ticket object.
*/
async function createTicket(ticket) {
  const createdTicket = await MraTickets.create(ticket);

  if (createdTicket && createdTicket.ticket_id) {
    const tickets = await getTickets({ ticket_id: createdTicket.ticket_id });
    return tickets[0];
  } else {
    return null;
  }
}

/**
* Updates ticket in the database based on the provided ticketId and ticket.
*
* @param {object} where - The object containing `where` clauses to specify the search criteria.
* @param {Object} ticket - The new ticket object.
* @returns {Object} The updated ticket object.
*/
async function updateTicket(where, ticket) {
  const [affectedRowCount] = await MraTickets.update(ticket, { where });

  if (affectedRowCount > 0) {
    const updatedTickets = await getTickets(where);
    return updatedTickets[0];
  } else {
    return null;
  }
}

/**
* Deletes ticket from the database based on the provided ticketId.
*
* @param {object} where - The object containing `where` clauses to specify the search criteria.
* @returns {boolean} True if the ticket was successfully deleted, otherwise false.
*/
async function deleteTicket(where) {
  const deletedRowCount = await MraTickets.destroy({ where });
  return deletedRowCount > 0;
}

/**
 * Checks if a customer is private based on the provided customer ID.
 *
 * @param {number} customerId - The ID of the customer.
 * @returns {Promise<boolean>} A promise that resolves to true if the customer is private, false otherwise.
 */
const isPrivateCustomer = async (customerId) => {
  if (!customerId) {
    return false; // Returns false if no customerId is provided
  }

  const customer = await MraCustomers.findByPk(customerId, {
    attributes: ['is_private'], // Optionally limit to only load the 'is_private' field
  });

  // Check if customer was found and return the 'is_private' status, otherwise false
  return customer ? customer.is_private : false;
};


module.exports = {
  closeDBConnections,
  insertAuditLog,
  updateAuditLog,
  deleteAuditLog,
  getUserByUserId,
  getUserByUsername,
  deleteUserByUsername,
  activateUser,
  getUserDetails,
  createUserDetails,
  updateUserDetails,
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  isPrivateCustomer
};
