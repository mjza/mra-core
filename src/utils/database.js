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
  
  if(isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0)
    throw new Error('Limit and offset must be valid numbers');

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

  if(isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0)
    throw new Error('Limit and offset must be valid numbers');

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

  if (where && where.user_id) {

    const user = await MraUsers.findOne({
      where: { user_id: where.user_id },
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
 * @param {object} pagination - The pagination settings containing 'limit' and 'offset'.
 *                              'limit' defines the number of user details to fetch.
 *                              'offset' specifies the number of user details to skip.
 * @returns {Object[]} An array of ticket objects.
 */
async function getTickets(where, pagination, order = [['created_at', 'DESC']]) {
  const { limit, offset } = pagination;

  if(isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0)
    throw new Error('Limit and offset must be valid numbers');

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
 * @param {number} customerTypeId - The ID of the customer type to filter categories.
 * @param {object} pagination - The pagination settings containing 'limit' and 'offset'.
 *                              'limit' defines the number of user details to fetch.
 *                              'offset' specifies the number of user details to skip.
 * @returns {Promise<Array>} A promise that resolves to an array of similar ticket categories.
 */
async function getTicketCategories(ticketTitle, latitude, longitude, customerId, customerTypeId, pagination) {
  const { limit, offset } = pagination;

  if(isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0)
    throw new Error('Limit and offset must be valid numbers');

  const geoCondition = latitude && longitude ? `ST_Contains(tc.boundary, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326))` : 'true';
  const customerCondition = customerId ? `tc.customer_id = :customerId` : 'tc.customer_id IS NULL';
  const customerTypeCondition = customerTypeId ? `tc.customer_type_id = :customerTypeId` : 
  customerId ? `tc.customer_type_id = (SELECT c.customer_type_id FROM mra_customers c WHERE c.customer_id = :customerId)` : 'true';

  // Tokenize the ticket title by splitting it into individual words
  const tokens = ticketTitle ? ticketTitle.trim().split(/\s+/) : [];

  // Construct the similarity condition and rank calculation based on tokens
  let ticketTitleCondition = 'true';
  let rankCalculation = '1 AS rank';

  if (tokens.length > 0) {
    const similarityConditions = tokens.map((token, index) => `
      (tc.ticket_category_name ILIKE '%' || :token${index} || '%' OR tc.description ILIKE '%' || :token${index} || '%')`);

    const rankCalculations = tokens.map((token, index) => `
      (similarity(tc.ticket_category_name, :token${index}) + similarity(tc.description, :token${index}))`);

    ticketTitleCondition = `(${similarityConditions.join(' OR ')})`;
    rankCalculation = `${rankCalculations.join(' + ')} AS rank`;
  }

  // Build the JOIN and additional WHERE conditions
  let joinClause = '';
  let additionalCondition = 'true';
  if (!customerId) {
    joinClause = `LEFT JOIN mra_customers c ON c.customer_id = tc.customer_id`;
    additionalCondition = `COALESCE(c.is_private, false) = false`;
  }

  const query = `
    SELECT 
      tc.ticket_category_id, 
      tc.ticket_category_name, 
      tc.description,
      tc.parent_category_id, 
      tc.customer_type_id, 
      tc.customer_id, 
      tc.source_id, 
      tc.boundary, 
      tc.is_active, 
      tc.creator, 
      tc.created_at, 
      tc.updator, 
      tc.updated_at,
      ${rankCalculation}
    FROM 
      mra_ticket_categories tc
    ${joinClause}
    WHERE 
      ${ticketTitleCondition}
      AND 
      (
        ${geoCondition}
        AND
        (
          ${customerCondition}
          ${customerId ? 'OR' : 'AND'} 
          ${customerTypeCondition}
        )
      )
      AND
      ${additionalCondition}
      ${customerId ? `
        AND NOT EXISTS (
          SELECT 1 
          FROM mra_ticket_categories tc_sub 
          WHERE 
            tc_sub.source_id = tc.ticket_category_id 
            AND tc_sub.customer_id IS NOT NULL
            AND tc_sub.customer_id = :customerId
        )` : ''}
    ORDER BY rank DESC
    LIMIT :limit OFFSET :offset;
  `;

  // Create replacements object for Sequelize query
  const replacements = { limit, offset };
  tokens.forEach((token, index) => {
    replacements[`token${index}`] = token;
  });

  if (latitude && longitude) {
    replacements.latitude = latitude;
    replacements.longitude = longitude;
  }
  if (customerId) {
    replacements.customerId = customerId;
  }
  if (customerTypeId) {
    replacements.customerTypeId = customerTypeId;
  }

  const results = await sequelize.query(query, {
    replacements,
    type: Sequelize.QueryTypes.SELECT
  });

  return results;
}

/**
 * Retrieves country records from the MragCountries table with optional filtering and pagination.
 *
 * @async
 * @function getCountries
 * @param {Object} where - Additional conditions to filter the countries.
 * @param {Object} pagination - Pagination details.
 * @param {number} pagination.limit - The maximum number of records to return.
 * @param {number} pagination.offset - The number of records to skip before starting to collect the result set.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of countries.
 * @throws {Error} If there is an error fetching countries from the database.
 */
async function getCountries(where = {}, pagination) {
  const { limit, offset } = pagination;

  if(isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0)
    throw new Error('Limit and offset must be valid numbers');
  
  try {
    const countries = await MragCountries.findAll({
      where: convertSequelizeOperators({
        ...where,
        is_valid: true,
      }),
      limit,
      offset,
      attributes: [
        'country_id',
        'country_name',
        'iso_code',
        'iso_long_code',
        'dial_code',
        'languages',
        'is_supported',
      ],
    });

    return countries && countries.map(country => country.get({ plain: true }));
  } catch (error) {
    console.error("Error fetching countries:", error);
    throw error;
  }
}

/**
 * Represents an Address with detailed information.
 *
 * The `Address` class encapsulates various details about an address, including geographic coordinates,
 * street information, city, region, postal code, and the full formatted address.
 *
 * @class
 */
class Address {
  /**
   * Creates an instance of Address.
   * 
   * @constructor
   * @param {Object} data - The data object containing address details.
   * @param {number} data.id - The unique identifier of the address.
   * @param {number} data.geo_latitude - The latitude coordinate of the address.
   * @param {number} data.geo_longitude - The longitude coordinate of the address.
   * @param {string} [data.street_name] - The name of the street.
   * @param {string} [data.street_type] - The type of the street (e.g., Ave, Blvd).
   * @param {string} [data.street_quad] - The quadrant of the street (e.g., NW, SE).
   * @param {string} [data.street_full_name] - The full name of the street.
   * @param {string} [data.street_no] - The street number.
   * @param {string} [data.house_number] - The house number.
   * @param {string} [data.house_alpha] - The house alpha.
   * @param {string} [data.unit] - The unit or apartment number.
   * @param {string} [data.city] - The city in which the address is located.
   * @param {string} [data.region] - The region or state in which the address is located.
   * @param {string} [data.postal_code] - The postal code of the address.
   * @param {string} [data.full_address] - The full formatted address.
   * @param {string} [data.country_code] - The iso code of the country.
   * @param {string} [data.country_name] - The name of the country.
   */
  constructor(data) {
    this.id = data.id;
    this.geo_latitude = data.geo_latitude;
    this.geo_longitude = data.geo_longitude;
    this.street_name = data.street_name;
    this.street_type = data.street_type;
    this.street_quad = data.street_quad;
    this.street_full_name = data.street_full_name;
    this.street_no = data.street_no;
    this.house_number = data.house_number;
    this.house_alpha = data.house_alpha;
    this.unit = data.unit;
    this.city = data.city;
    this.region = data.region;
    this.postal_code = data.postal_code;
    this.full_address = data.full_address;
    this.country_code = data.country_code;
    this.country_name = data.country_name;
  }
}

/**
 * Retrieves address data based on the provided geographic coordinates.
 *
 * This function executes a PostgreSQL function `mra_function_get_address_data_rs` to fetch address information 
 * for the given longitude and latitude. The results are mapped to instances of the `Address` class.
 *
 * @async
 * @function getAddressData
 * @param {number} longitude - The longitude of the location.
 * @param {number} latitude - The latitude of the location.
 * @returns {Promise<Array<Address>>} A promise that resolves to an array of `Address` instances containing the address data.
 * @throws {Error} If there is an error executing the database function.
 */
async function getAddressData(longitude, latitude) {
  try {
      const results = await sequelize.query(
          `SELECT * FROM mra_function_get_address_data_rs(:longitude, :latitude)`,
          {
              replacements: { longitude, latitude },
              type: Sequelize.QueryTypes.SELECT
          }
      );

      // Map the results to Address instances
      const addresses = results.map(result => new Address(result));

      return addresses;
  } catch (error) {
      console.error('Error executing function:', error);
      throw error;
  }
}

/**
 * Represents a Location with country, state, and city details.
 *
 * The `Location` class encapsulates the information returned by the `mra_function_get_location_data_json`
 * PostgreSQL function, including country, state, and city details along with their respective IDs.
 *
 * @class
 */
class Location {
  /**
   * Creates an instance of Location.
   * 
   * @constructor
   * @param {Object} data - The data object containing location details.
   * @param {number} data.country_id - The unique identifier of the country.
   * @param {string} data.country_code - The ISO code of the country.
   * @param {string} data.country_name - The name of the country.
   * @param {number} data.state_id - The unique identifier of the state or region.
   * @param {string} data.state - The name of the state or region.
   * @param {number} data.city_id - The unique identifier of the city or town.
   * @param {string} data.city - The name of the city or town.
   */
  constructor(data) {
    this.country_id = data.country_id;
    this.country_code = data.country_code;
    this.country_name = data.country_name;
    this.state_id = data.state_id;
    this.state = data.state;
    this.city_id = data.city_id;
    this.city = data.city;
  }
}

/**
 * Retrieves location data based on the provided geographic coordinates.
 *
 * This function executes the PostgreSQL function `mra_function_get_location_data_json` to fetch 
 * country, state, and city information for the given longitude and latitude. The results are 
 * mapped to an instance of the `Location` class.
 *
 * @async
 * @function getLocationData
 * @param {number} longitude - The longitude of the location.
 * @param {number} latitude - The latitude of the location.
 * @returns {Promise<Location>} A promise that resolves to a `Location` instance containing the location data.
 * @throws {Error} If there is an error executing the database function.
 */
async function getLocationData(longitude, latitude) {
  try {
    const results = await sequelize.query(
      `SELECT * FROM mra_function_get_location_data_json(:longitude, :latitude)`,
      {
        replacements: { longitude, latitude },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Map the results to Location instances
    const locations = results.map(result => {
      return result.mra_function_get_location_data_json ?? result;
    }).map(result => new Location(result));

    return locations && locations.length > 0 ? locations[0] : null;
  } catch (error) {
    console.error('Error executing function:', error);
    throw error;
  }
}

/**
 * Retrieves states for a given country based on its ISO code.
 *
 * This function calls the PostgreSQL function `mra_function_get_states_by_country_code` to fetch 
 * all states within the country identified by the given ISO code. The results 
 * are returned as an array of state objects.
 *
 * @async
 * @function getStatesByCountryCode
 * @param {string} countryCode - The ISO code of the country.
 * @returns {Promise<Array<{state_id: number, state_name: string}>>} A promise that resolves to an array of state objects.
 * @throws {Error} If there is an error executing the database function.
 */
async function getStatesByCountryCode(countryCode) {
  try {
    const results = await sequelize.query(
      `SELECT * FROM mra_function_get_states_by_country_code(:country_iso_code)`,
      {
        replacements: { country_iso_code: countryCode },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Return the results directly, as they are already in the desired format
    return results;
  } catch (error) {
    console.error('Error executing function:', error);
    throw error;
  }
}

/**
 * Retrieves states for a given country based on its ID.
 *
 * This function calls the PostgreSQL function `mra_function_get_states_by_country_id` to fetch 
 * all states within the country identified by the given country ID. The results 
 * are returned as an array of state objects.
 *
 * @async
 * @function getStatesByCountryId
 * @param {number} countryId - The ID of the country.
 * @returns {Promise<Array<{state_id: number, state_name: string}>>} A promise that resolves to an array of state objects.
 * @throws {Error} If there is an error executing the database function.
 */
async function getStatesByCountryId(countryId) {
  try {
    const results = await sequelize.query(
      `SELECT * FROM mra_function_get_states_by_country_id(:country_id)`,
      {
        replacements: { country_id: countryId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Return the results directly, as they are already in the desired format
    return results;
  } catch (error) {
    console.error('Error executing function:', error);
    throw error;
  }
}


/**
 * Retrieves cities for a given state in a specified country.
 *
 * This function calls the PostgreSQL function `mra_function_get_cities_by_state` to fetch 
 * all cities that belong to the specified state within the given country. The results 
 * are returned as an array of city objects.
 *
 * @async
 * @function getCitiesByState
 * @param {number} countryId - The ID of the country.
 * @param {number} stateId - The ID of the state.
 * @returns {Promise<Array<{city_id: number, city_name: string}>>} A promise that resolves to an array of city objects.
 * @throws {Error} If there is an error executing the database function.
 */
async function getCitiesByState(countryId, stateId) {
  try {
    const results = await sequelize.query(
      `SELECT * FROM mra_function_get_cities_by_state(:country_id, :state_id)`,
      {
        replacements: { country_id: countryId, state_id: stateId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Return the results directly, as they are already in the desired format
    return results;
  } catch (error) {
    console.error('Error executing function:', error);
    throw error;
  }
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
  getTicketCategories,
  getAddressData,
  getLocationData,
  getCountries,
  getStatesByCountryCode,
  getStatesByCountryId,
  getCitiesByState
};
