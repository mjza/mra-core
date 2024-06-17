const { Sequelize, sequelize, closeSequelize, MraUsers, MraAuditLogsCore, MraGenderTypes, MraUserDetails, MraTickets, MraCustomers, MraTicketCategories, MragCountries, MragCities, } = require('../models');
const { Op } = Sequelize;
/**
 * Closes the database connection pool.
 */
const closeDBConnections = async () => {
  await closeSequelize();
};

/**
 * Adds date range filters to the Sequelize query `where` clause based on the specified field.
 * This function handles both the start and end of the date range by checking for specific
 * suffixes ('After' and 'Before') appended to the field name in the query parameters.
 *
 * @param {Object} where - The existing Sequelize `where` clause object which the function modifies.
 * @param {Object} query - The request query object containing potential date range parameters.
 * @param {string} field - The base name of the date field to which the date range filters will apply.
 *                         The function expects to find query parameters with names formed by appending
 *                         'After' and 'Before' to this base field name (e.g., 'createdAtAfter' for 'createdAt').
 */
const addDateRangeFilter = (where, query, field) => {
  const fieldAfter = `${field}After`;
  const fieldBefore = `${field}Before`;

  if (query[fieldAfter] || query[fieldBefore]) {
    where[field] = {};
    if (query[fieldAfter]) {
      where[field][Sequelize.Op.gte] = new Date(query[fieldAfter]);
    }
    if (query[fieldBefore]) {
      where[field][Sequelize.Op.lte] = new Date(query[fieldBefore]);
    }
  }
};

/**
 * Converts string representations of Sequelize operator keys to their respective Sequelize symbol operators.
 * This function is particularly useful when operators are stored or transmitted as strings (e.g., in JSON format)
 * and need to be converted back to symbols for query processing in Sequelize.
 *
 * The function handles nested objects and arrays recursively, ensuring all operator strings are converted throughout
 * the entire structure of the input `where` clause object.
 *
 * @param {Object|Array} where - The `where` clause object or array containing potential string representations
 *                               of Sequelize operators. If an array or non-operator object key is encountered,
 *                               it recurses into that structure to convert nested operators.
 * @returns {Object|Array} The `where` clause object or array with all operator strings converted to Sequelize symbols.
 *                         Structure and data types other than operator strings are preserved as is.
 *
 * @example
 * // Usage example:
 * const whereClause = {
 *   'Sequelize.Op.or': [
 *     { 'Sequelize.Op.like': '%value%' },
 *     { 'Sequelize.Op.gte': 10 }
 *   ],
 *   'someField': 'someValue'
 * };
 *
 * const convertedWhereClause = convertSequelizeOperators(whereClause);
 * // convertedWhereClause now contains:
 * // {
 * //   [Sequelize.Op.or]: [
 * //     { [Sequelize.Op.like]: '%value%' },
 * //     { [Sequelize.Op.gte]: 10 }
 * //   ],
 * //   'someField': 'someValue'
 * // }
 * // which is suitable for use in Sequelize queries.
 */
const convertSequelizeOperators = (where) => {
  const opMap = {
    'Sequelize.Op.or': Op.or,
    'Sequelize.Op.and': Op.and,
    'Sequelize.Op.gt': Op.gt,
    'Sequelize.Op.gte': Op.gte,
    'Sequelize.Op.lt': Op.lt,
    'Sequelize.Op.lte': Op.lte,
    'Sequelize.Op.ne': Op.ne,
    'Sequelize.Op.eq': Op.eq,
    'Sequelize.Op.not': Op.not,
    'Sequelize.Op.between': Op.between,
    'Sequelize.Op.notBetween': Op.notBetween,
    'Sequelize.Op.in': Op.in,
    'Sequelize.Op.notIn': Op.notIn,
    'Sequelize.Op.like': Op.like,
    'Sequelize.Op.notLike': Op.notLike,
    'Sequelize.Op.iLike': Op.iLike, // Specific to PostgreSQL
    'Sequelize.Op.notILike': Op.notILike, // Specific to PostgreSQL
    'Sequelize.Op.startsWith': Op.startsWith,
    'Sequelize.Op.endsWith': Op.endsWith,
    'Sequelize.Op.substring': Op.substring,
    'Sequelize.Op.overlap': Op.overlap, // Specific to PostgreSQL arrays
    'Sequelize.Op.contains': Op.contains,
    'Sequelize.Op.contained': Op.contained,
    'Sequelize.Op.any': Op.any,
    'Sequelize.Op.regexp': Op.regexp, // Specific to MySQL and PostgreSQL
    'Sequelize.Op.iRegexp': Op.iRegexp, // Specific to PostgreSQL
    'Sequelize.Op.like': Op.like,
    'Sequelize.Op.notLike': Op.notLike,
  };

  const translate = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (obj instanceof Array) {
      return obj.map(translate);
    }

    return Object.entries(obj).reduce((acc, [key, value]) => {
      const newKey = opMap[key] || key;
      acc[newKey] = translate(value);
      return acc;
    }, {});
  };

  return translate(where);
}

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
 * Retrieves gender types from the database with optional filtering and pagination.
 *
 * @async
 * @function getGenderTypes
 * @param {Object} where - The conditions to filter the gender types.
 * @param {Object} pagination - Pagination details.
 * @param {number} pagination.limit - The maximum number of records to return.
 * @param {number} pagination.offset - The number of records to skip before starting to collect the result set.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of gender types.
 * @throws {Error} If there is an error fetching gender types from the database.
 */
async function getGenderTypes(where, pagination) {
  const { limit, offset } = pagination;
  try {
    const genderTypes = await MraGenderTypes.findAll({
      where,
      limit,
      offset,
      attributes: ['gender_id', 'gender_name', 'sort_order'],
    });

    return genderTypes && genderTypes.map(genderType => genderType.get({ plain: true }));
  } catch (error) {
    console.error("Error fetching gender types:", error);
    throw error;
  }
}

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
 *                     private_profile_picture_url, creator, created_at,
 *                     updator, and updated_at. Caller must pass `limit + 1` so if more items
 *                     are available, allowing the caller to determine if additional pages exist.
 */
async function getUserDetails(where, pagination) {
  const { limit, offset } = pagination;
  const userDetails = await MraUserDetails.findAll({
    where,
    limit,
    offset,
    include: [
      {
        model: MraGenderTypes,
        as: "gender",
        attributes: ['gender_id', 'gender_name'],
      },
      {
        model: MraUsers,
        as: 'user',
        attributes: ['public_profile_picture_url', 'email', 'display_name']
      }
    ],
    attributes: ['user_id', 'first_name', 'middle_name', 'last_name', 'gender_id', 'date_of_birth', 'private_profile_picture_url', 'creator', 'created_at', 'updator', 'updated_at'],
  });

  if (userDetails.length > 0) {
    return userDetails.map(userDetail => {
      const userDetailPlain = userDetail.get({ plain: true });
      if (userDetailPlain.user) {
        userDetailPlain.profile_picture_url = userDetailPlain.user.public_profile_picture_url;
        userDetailPlain.email = userDetailPlain.user.email;
        userDetailPlain.display_name = userDetailPlain.user.display_name;
        delete userDetailPlain.user;
      }
      if (userDetailPlain.profile_picture_url !== null) {
        userDetailPlain.is_private_picture = false;
      } else {
        userDetailPlain.profile_picture_url = userDetailPlain.private_profile_picture_url;
        userDetailPlain.is_private_picture = !!userDetailPlain.profile_picture_url;
        delete userDetailPlain.private_profile_picture_url;
      }
      return userDetailPlain;
    });
  }

  if(where && where.user_id) {
    
    const user = await MraUsers.findOne({
      where: { user_id: where.user_id},
      attributes: ['user_id', 'public_profile_picture_url', 'email', 'display_name'],
    });
        
    const userPlain = user && user.get({ plain: true });

    if (userPlain) {
      userPlain.profile_picture_url = userPlain.public_profile_picture_url;
      userPlain.is_private_picture = false;
      delete userPlain.public_profile_picture_url;
      return [{
        ...userPlain,
        first_name: null,
        middle_name: null,
        last_name: null,
        gender_id: null,
        date_of_birth: null,
        creator: null,
        created_at: null,
        updator: null,
        updated_at: null
      }];
    }
  }

  return null;
}

/**
 * Updates the profile picture URL in the `MraUsers` model if it is public, or prepares it for storing in `MraUserDetails` if it is a private picture.
 * 
 * This function is only called internally by `createUserDetails` or `updateUserDetails` to handle the profile picture URL.
 *
 * @param {Object} userDetails - The user details object containing profile picture information.
 * @param {Object} [where] - The condition for updating the record, typically contains the user ID.
 * @returns {Promise<Object>} The updated userDetails object.
 * @throws {Error} If the user's profile picture URL could not be stored publicly.
 */
async function storeUserPublicInformation(userDetails, where) {
  let public_profile_picture_url;
  if (userDetails.is_private_picture === true) {
    public_profile_picture_url = null;
    userDetails.private_profile_picture_url = userDetails.profile_picture_url;
    delete userDetails.profile_picture_url;
    delete userDetails.is_private_picture;
  } else {
    public_profile_picture_url = userDetails.profile_picture_url;
    delete userDetails.profile_picture_url;
    delete userDetails.is_private_picture;
    userDetails.private_profile_picture_url = null;
  }
  const [updateCount] = await MraUsers.update(
    {
      email: userDetails.email,
      display_name: userDetails.display_name,
      public_profile_picture_url,
      updator: userDetails.updator || userDetails.creator,
    },
    {
      where: {
        // if where exist it means it is a update otherwise a create request
        user_id: where ? where.user_id : userDetails.user_id,
      },
      returning: true,
    }
  );
  if (updateCount < 0) {
    throw new Error('Couldn\'t store user\'s profile picture url publically.');
  }
  delete userDetails.email;
  delete userDetails.display_name;
  return userDetails;
}

/**
 * Creates new user details in the database.
 *
 * @param {Object} userDetails - The user details object.
 * @returns {Object} The created user details object.
 */
async function createUserDetails(userDetails) {

  userDetails = await storeUserPublicInformation(userDetails);
  const createdRow = await MraUserDetails.create(userDetails);

  if (createdRow && createdRow.user_id) {
    const userDetails = await getUserDetails({ user_id: createdRow.user_id }, { limit: 1, offset: 0 });
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
  userDetails = await storeUserPublicInformation(userDetails, where);
  const [affectedRowCount] = await MraUserDetails.update(userDetails, { where });

  if (affectedRowCount > 0) {
    const userDetails = await getUserDetails(where, { limit: 1, offset: 0 });
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
async function getTickets(where, pagination, order = [['created_at', 'DESC']]) {
  const { limit, offset } = pagination;

  const tickets = await MraTickets.findAll({
    where: convertSequelizeOperators(where),
    offset,
    limit,
    include: [
      {
        model: MragCountries,
        as: 'country',
        attributes: ['country_id', 'country_name'],
      }, {
        model: MragCities,
        as: 'city',
        attributes: ['city_id', 'city_name'],
      }, {
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
      'street', 'house_number', 'unit', 'city_name', 'region_name', 'postal_code', 'full_address',
      'creator', 'created_at', 'updator', 'updated_at', 'publisher', 'published_at', 'closed_at', 'close_reason'
    ],
    order
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
    const tickets = await getTickets({ ticket_id: createdTicket.ticket_id }, { limit: 1, offset: 0 });
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
    const updatedTickets = await getTickets(where, { limit: 1, offset: 0 });
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
  if (!customerId && isNaN(customerId)) {
    return false; // Returns false if no customerId is provided
  }

  const customer = await MraCustomers.findByPk(customerId, {
    attributes: ['is_private'], // Optionally limit to only load the 'is_private' field
    raw: true
  });

  // Check if customer was found and return the 'is_private' status, otherwise false
  return customer ? customer.is_private : false;
};

/**
 * Finds ticket categories similar to a given title and within a specified boundary or customer ID.
 *
 * @param {string} ticketTitle - The title of the ticket to search for similar categories.
 * @param {number} latitude - The latitude of the user's location.
 * @param {number} longitude - The longitude of the user's location.
 * @param {number} customerId - The ID of the customer to filter categories.
 * @returns {Promise<Array>} A promise that resolves to an array of similar ticket categories.
 */
async function getTicketCategories(ticketTitle, latitude, longitude, customerId) {
  const query = `
      SELECT ticket_category_id, ticket_category_name, description, 
             ts_rank_cd(search_vector, mra_function_construct_tsquery(replace(:ticketTitle, ' ', ' | '))) AS rank
      FROM mra_ticket_categories
      WHERE search_vector @@ mra_function_construct_tsquery(replace(:ticketTitle, ' ', ' | '))
        AND 
        (
          ST_Contains(boundary, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326))
        OR
          customer_id = :customerId
        )
      ORDER BY rank DESC;
  `;

  const results = await sequelize.query(query, {
      replacements: { ticketTitle, latitude, longitude, customerId },
      type: Sequelize.QueryTypes.SELECT
  });

  return results;
}

module.exports = {
  closeDBConnections,
  addDateRangeFilter,
  convertSequelizeOperators,
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
  isPrivateCustomer,
  getGenderTypes,
  getTicketCategories
};
