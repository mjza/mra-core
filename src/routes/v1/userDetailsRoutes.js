const express = require('express');
const { body, query, param } = require('express-validator');
const { authorizeUser, checkRequestValidity } = require('../../utils/validations');
const { toLowerCamelCase, toSnakeCase, encryptObjectItems, decryptObjectItems } = require('../../utils/converters');
const db = require('../../utils/database');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { updateEventLog } = require('../../utils/logger');
const moment = require('moment');
const router = express.Router();

// List of optional properties
const optionalProperties = [
  'first_name',
  'middle_name',
  'last_name',
  'gender_id',
  'date_of_birth',
  'profile_picture_url',
  'is_private_picture',
];

const secretProperties = [
  'first_name',
  'middle_name',
  'last_name',
  'date_of_birth'
];

class UserDetails {
  /**
   * Constructor for creating a userDetails object.
   * Only allows specific properties to ensure security by eliminating extra or unwanted properties.
   * @param {Object} userDetails - Object containing user details.
   * @param {number} userDetails.userId - User ID of the detail owner. 
   * @param {string} userDetails.firstName - First name of the user.
   * @param {string} [userDetails.middleName] - Middle name of the user.
   * @param {string} userDetails.lastName - Last name of the user.
   * @param {string} userDetails.displayName - Display name of the user.
   * @param {string} userDetails.email - Email of the user.
   * @param {number} userDetails.genderId - Gender ID of the user.
   * @param {string} userDetails.dateOfBirth - Date of birth of the user.
   * @param {string} userDetails.profilePictureUrl - Profile picture URL of the user.
   * @param {boolean} [userDetails.isPrivatePicture] - Whether the profile picture is private.
   */
  constructor({
    userId,
    firstName,
    middleName,
    lastName,
    displayName,
    email,
    genderId,
    dateOfBirth,
    profilePictureUrl,
    isPrivatePicture
  }) {
    // Explicitly assigning only known properties to avoid security issues from extra properties
    this.userId = userId;
    this.firstName = firstName;
    this.middleName = middleName;
    this.lastName = lastName;
    this.displayName = displayName;
    this.email = email;
    this.genderId = genderId;
    this.dateOfBirth = dateOfBirth;
    this.profilePictureUrl = profilePictureUrl;
    this.isPrivatePicture = isPrivatePicture;
  }
}

/**
 * @swagger
 * components:
 *   responses:
 *     UserDetailsObject:
 *       type: object
 *       properties:  
 *         userId:
 *           type: integer               
 *         firstName:
 *           type: string
 *         middleName:
 *           type: string
 *         lastName:
 *           type: string
 *         displayName:
 *           type: string
 *         email:
 *           type: string
 *         genderId:
 *           type: integer
 *         dateOfBirth:
 *           type: string
 *           format: date
 *         profilePictureUrl:
 *           type: string
 *           example: "https://abc.com/pic1.jpg"
 *         isPrivatePicture:
 *           type: boolean
 *           example: false
 *         creator:
 *           type: integer
 *           example: 2
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-04-02T05:44:24.563Z"
 *         updator:
 *           type: integer
 *           nullable: true
 *           example: null
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         gender:
 *           type: object
 *           properties:
 *             genderId:
 *               type: integer
 *               example: 1
 *             genderName:
 *               type: string
 *               example: "Female"
 */

/**
 * @swagger
 * /v1/user_details:
 *   get:
 *     summary: Retrieve user details
 *     description: Get the details of multiple users based on the provided conditions and pagination. If no specific userId is provided, details of the user whose ID matches the one in the JWT are returned. The response includes a flag to indicate if more records are available.
 *     tags: [2nd]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional user ID to retrieve details for a specific user.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number of the user details to retrieve.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Maximum number of user details to return in one response.
 *     responses:
 *       200:
 *         description: User details retrieved successfully, with an indicator if additional pages are available.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/responses/UserDetailsObject'
 *                 hasMore:
 *                   type: boolean
 *                   description: Indicates if more data is available beyond the current page.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       404:
 *         description: User details not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User details not found.
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/user_details', apiRequestLimiter,
  [
    query('userId')
      .optional({ checkFalsy: true })
      .isNumeric().withMessage('User ID must be a number.')
      .toInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .toInt()
      .default(1),  

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be a positive integer and no more than 100')
      .toInt()
      .default(30),
  ],
  checkRequestValidity,
  (req, res, next) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 30;
    req.pagination = {
      limit: limit + 1,
      offset: (page - 1) * limit
    };
    next();
  },
  (req, res, next) => {
    const userId = req.query && req.query.userId;
    const where = { user_id: userId && parseInt(userId, 10) };
    const middleware = authorizeUser({ dom: '0', obj: 'mra_user_details', act: 'R', attrs: { where } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      
      const userDetailsArray = await db.getUserDetails(req.conditions.where, req.pagination);
      
      if (!userDetailsArray || userDetailsArray.length === 0) {
        return res.status(404).json({ message: 'User details not found' });
      }

      // Determine if there are more items beyond the current page
      const hasMore = userDetailsArray.length > (req.pagination.limit - 1);
      const results = hasMore ? userDetailsArray.slice(0, -1) : userDetailsArray; // Remove the extra item if present      

      const decryptedDataArray = results.map(userDetails => {
        // Copy the array and add a new item
        const newSecretProperties = userDetails.is_private_picture === true ? [...secretProperties, 'profile_picture_url'] : [...secretProperties];
        return toLowerCamelCase(decryptObjectItems(userDetails, newSecretProperties))
      });

      return res.json({ data: decryptedDataArray, hasMore });
    } catch (err) {
      updateEventLog(req, err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/user_details:
 *   post:
 *     summary: Create user details
 *     description: Create details for the user whose ID matches the one in the JWT.
 *     tags: [2nd]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 required: true
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               middleName:
 *                 type: string
 *               lastName:
 *                 type: string
 *                 example: "Doh"
 *               displayName:
 *                 type: string
 *                 example: "Doh"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "a@b.com"
 *               genderId:
 *                 type: integer
 *                 example: 1 
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               profilePictureUrl:
 *                 type: string
 *                 example: "https://abc.com/pic1.jpg"
 *               isPrivatePicture:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: User details created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/UserDetailsObject'
 *       400:
 *         description: Invalid request parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         example: First name must be a string.
 *                       param:
 *                         type: string
 *                         example: firstName
 *                       location:
 *                         type: string
 *                         example: body
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       403:
 *         description: Unauthorized access - Update other users!
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User is not authorized.
 *       422:
 *         description: |
 *           Unprocessable Content. This can occur in different scenarios:
 *           - Duplicate record: A record exists for the current user in the user details table.
 *           - Foreign key violation: Invalid foreign key value.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: A record exists for the current user in the user details table.
 *                 details:
 *                   type: string
 *                   example: duplicate key value violates unique constraint 'mra_user_details_pkey'
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.post('/user_details', apiRequestLimiter,
  [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required.')
      .isInt({ gt: 0 })
      .withMessage('User ID must be an integer greater than 0.'),

    body('firstName')
      .optional({ nullable: true })
      .isString()
      .withMessage('First name must be a string.')
      .isLength({ max: 255 })
      .withMessage('First name must not exceed 255 characters.'),

    body('middleName')
      .optional({ nullable: true })
      .isString()
      .withMessage('Middle name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Middle name must not exceed 255 characters.'),

    body('lastName')
      .optional({ nullable: true })
      .isString()
      .withMessage('Last name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Last name must not exceed 255 characters.'),

    body('displayName')
      .optional({ nullable: true })
      .isString()
      .withMessage('Display name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Display name must not exceed 255 characters.'),

    body('email')
      .isEmail()
      .withMessage('Invalid email address.')
      .isLength({ min: 5, max: 255 })
      .withMessage('Email must be between 5 and 255 characters.'),

    body('genderId')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 9 })
      .withMessage('Gender ID must be an integer between 0 and 9, inclusive.'),

    body('dateOfBirth')
      .optional({ nullable: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/, 'i')
      .withMessage('Date of birth must be in YYYY-MM-DD format.')
      .custom(value => {
        return moment(value, 'YYYY-MM-DD', true).isValid();
      })
      .withMessage('Date of birth must be a valid date.'),

    body('profilePictureUrl')
      .optional({ nullable: true })
      .isString()
      .withMessage('Private profile picture URL must be a string.')
      .isURL()
      .withMessage('Private profile picture URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Private profile picture URL must not exceed 255 characters.'),

    body('isPrivatePicture')
      .optional({ nullable: true })
      .isBoolean()
      .withMessage('isPrivatePicture must be a boolean.'),
  ],
  checkRequestValidity,
  (req, res, next) => {
    const body = req.body;
    const processedBody = toSnakeCase(new UserDetails(body));
    const middleware = authorizeUser({ dom: '0', obj: 'mra_user_details', act: 'C', attrs: { set: processedBody } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const userDetails = req.conditions.set;

      // Set missing properties to null
      optionalProperties.forEach(prop => {
        if (userDetails[prop] === undefined) {
          userDetails[prop] = null;
        }
      });
      // Copy the array and add a new item
      const newSecretProperties = userDetails.is_private_picture === true ? [...secretProperties, 'profile_picture_url'] : [...secretProperties];
      const createdUserDetails = await db.createUserDetails(encryptObjectItems(userDetails, newSecretProperties));
      return res.status(201).json(toLowerCamelCase(decryptObjectItems(createdUserDetails, newSecretProperties)));
    } catch (err) {
      updateEventLog(req, err);

      const errorCode = err.original?.code;

      if (errorCode === '23505') { // PostgreSQL foreign key violation error code
        return res.status(422).json({ message: 'A record exists for the current user in the user details table.', details: err.message });
      }

      if (errorCode === '23503') { // PostgreSQL foreign key violation error code
        return res.status(422).json({ message: 'Invalid foreign key value.', details: err.message });
      }

      // Handle other types of errors (e.g., validation errors from Sequelize)
      if (err.name === 'SequelizeValidationError') {
        // Map through err.errors for detailed messages or handle collectively
        const message = 'Validation error occurred.';
        return res.status(400).json({ message, details: err.errors.map(e => e.message) });
      }

      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/user_details/{userId}:
 *   put:
 *     summary: Update user details
 *     description: Update details for the user whose ID matches the one in the JWT.
 *     tags: [2nd]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               middleName:
 *                 type: string
 *               lastName:
 *                 type: string
 *                 example: "Doh"
 *               displayName:
 *                 type: string
 *                 example: "Doh"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "a@b.com"
 *               genderId:
 *                 type: integer
 *                 example: 2 
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               profilePictureUrl:
 *                 type: string
 *                 example: "https://abc.com/pic1.jpg"
 *               isPrivatePicture:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: User details updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/UserDetailsObject'
 *       400:
 *         description: UserId is required.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: UserId is required.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       403:
 *         description: Unauthorized access - Update other users!
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized to update details for other users. 
 *       404:
 *         description: Not Found - There is no record in the 'user_details' table.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: There is no record for this user in the user details table.
 *       422:
 *         description: Unprocessable Content.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid foreign key value.
 *                 details:
 *                   type: string
 *                   example: insert or update on table 'user_details' violates foreign key constraint 'user_details_gender_id_fkey'
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.put('/user_details/:userId', apiRequestLimiter,
  [
    param('userId')
      .exists()
      .withMessage('UserId is required.')
      .matches(/^[\d]+$/)
      .withMessage('UserId must be a number.'),

    body('firstName')
      .optional({ nullable: true })
      .isString()
      .withMessage('First name must be a string.')
      .isLength({ max: 255 })
      .withMessage('First name must not exceed 255 characters.'),

    body('middleName')
      .optional({ nullable: true })
      .isString()
      .withMessage('Middle name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Middle name must not exceed 255 characters.'),

    body('lastName')
      .optional({ nullable: true })
      .isString()
      .withMessage('Last name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Last name must not exceed 255 characters.'),

    body('displayName')
      .optional({ nullable: true })
      .isString()
      .withMessage('Display name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Display name must not exceed 255 characters.'),

    body('email')
      .isEmail()
      .withMessage('Invalid email address.')
      .isLength({ min: 5, max: 255 })
      .withMessage('Email must be between 5 and 255 characters.'),  

    body('genderId')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 9 })
      .withMessage('Gender ID must be an integer between 0 and 9, inclusive.'),

    body('dateOfBirth')
      .optional({ nullable: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/, 'i')
      .withMessage('Date of birth must be in YYYY-MM-DD format.')
      .custom(value => {
        return moment(value, 'YYYY-MM-DD', true).isValid();
      })
      .withMessage('Date of birth must be a valid date.'),

    body('profilePictureUrl')
      .optional({ nullable: true })
      .isString()
      .withMessage('Private profile picture URL must be a string.')
      .isURL()
      .withMessage('Private profile picture URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Private profile picture URL must not exceed 255 characters.'),

    body('isPrivatePicture')
      .optional({ nullable: true })
      .isBoolean()
      .withMessage('isPrivatePicture must be a boolean.'),
  ],
  checkRequestValidity,
  (req, res, next) => {
    const body = req.body;
    const processedBody = toSnakeCase(new UserDetails(body));
    const middleware = authorizeUser({ dom: '0', obj: 'mra_user_details', act: 'U', attrs: { where: { user_id: parseInt(req.params.userId, 10) }, set: processedBody } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const userDetails = req.conditions.set;

      // Set missing properties to null
      optionalProperties.forEach(prop => {
        if (userDetails[prop] === undefined) {
          userDetails[prop] = null;
        }
      });

      // Copy the array and add a new item
      const newSecretProperties = userDetails.is_private_picture === true ? [...secretProperties, 'profile_picture_url'] : [...secretProperties];
      const updatedUserDetails = await db.updateUserDetails(encryptObjectItems(userDetails, newSecretProperties), req.conditions.where);

      if (!updatedUserDetails) {
        return res.status(404).json({ message: 'There is no record for this user in the user details table.' });
      }

      return res.status(200).json(toLowerCamelCase(decryptObjectItems(updatedUserDetails, newSecretProperties)));
    } catch (err) {
      updateEventLog(req, err);

      if (err.code === '23503') { // PostgreSQL foreign key violation error code
        return res.status(422).json({ message: 'Invalid foreign key value.', details: err.message });
      }

      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
