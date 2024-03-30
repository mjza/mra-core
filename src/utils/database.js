const { MraUsers, MraAuditLogsCore, closeSequelize, Sequelize, MraGenderTypes, MraUserDetails } = require('../models');

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

/**
 * Retrieves user details from the database based on the provided userId.
 *
 * @param {number} userId - The user's unique identifier.
 * @returns {Object} The user details object.
 */
async function getUserDetails(userId) {
  if (isNaN(userId))
    return null;

  const userDetails = await MraUserDetails.findOne({
    where: { user_id: userId },
    include: [{
      model: MraGenderTypes,
      as: "gender",
      attributes: ['gender_id', 'gender_name'],
    }],
    attributes: ['user_id', 'first_name', 'middle_name', 'last_name', 'gender_id', 'date_of_birth', 'profile_picture_url', 'profile_picture_thumbnail_url', 'creator', 'created_at', 'updator', 'updated_at'],
  });

  return userDetails && userDetails.get({ plain: true });
}

/**
 * Creates new user details in the database.
 *
 * @param {Object} userDetails - The user details object.
 * @returns {Object} The created user details object.
 */
async function createUserDetails(userDetails) {
  const createdUser = await MraUserDetails.create({
    user_id: userDetails.userId,
    first_name: userDetails.firstName,
    middle_name: userDetails.middleName,
    last_name: userDetails.lastName,
    gender_id: userDetails.genderId,
    date_of_birth: userDetails.dateOfBirth,
    profile_picture_url: userDetails.profilePictureUrl,
    profile_picture_thumbnail_url: userDetails.profilePictureThumbnailUrl,
    display_name: userDetails.displayName,
    public_profile_picture_thumbnail_url: userDetails.publicProfilePictureThumbnailUrl,
    creator: userDetails.creator
  });

  if (createdUser && createdUser.user_id) {
    return await getUserDetails(userDetails.userId);
  } else {
    return null;
  }
}

/**
 * Updates user details in the database based on the provided userId and userDetails.
 *
 * @param {number} userId - The user's unique identifier.
 * @param {Object} userDetails - The new user details object.
 * @returns {Object} The updated user details object.
 */
async function updateUserDetails(userId, userDetails) {
  await MraUserDetails.update({
    first_name: userDetails.firstName,
    middle_name: userDetails.middleName,
    last_name: userDetails.lastName,
    gender_id: userDetails.genderId,
    date_of_birth: userDetails.dateOfBirth,
    profile_picture_url: userDetails.profilePictureUrl,
    profile_picture_thumbnail_url: userDetails.profilePictureThumbnailUrl,
    display_name: userDetails.displayName,
    public_profile_picture_thumbnail_url: userDetails.publicProfilePictureThumbnailUrl,
    updator: userDetails.updator
  }, {
    where: { user_id: userId }
  });

  const updatedUserDetails = await getUserDetails(userId);
  return updatedUserDetails;
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
      where: { username: username.trim() }
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

  const user = await MraUsers.findOne({ where: { username: username.trim() } });
  if (!user) {
    return null;
  }

  await MraUsers.destroy({
    where: {
      username: username.trim(),
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
        username: username.trim(),
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

module.exports = {
  insertAuditLog,
  updateAuditLog,
  deleteAuditLog,
  closeDBConnections,
  getUserByUserId,
  getUserByUsername,
  deleteUserByUsername,
  activateUser,
  getUserDetails,
  createUserDetails,
  updateUserDetails
};
