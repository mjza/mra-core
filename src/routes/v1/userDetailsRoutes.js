const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authorizeUser } = require('../../utils/validations');
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
  'profile_picture_thumbnail_url',
  'display_name',
  'public_profile_picture_thumbnail_url'
];

const secretProperties = [
  'first_name',
  'middle_name',
  'last_name',
  'date_of_birth',
  'profile_picture_url',
  'profile_picture_thumbnail_url',
];

/**
 * @swagger
 * components:
 *   requests:
 *     UserDetailsBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               middleName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               genderId:
 *                 type: integer
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               profilePictureUrl:
 *                 type: string
 *               profilePictureThumbnailUrl:
 *                 type: string
 *               displayName:
 *                 type: string
 *               publicProfilePictureThumbnailUrl:
 *                 type: string
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
 *         genderId:
 *           type: integer
 *         dateOfBirth:
 *           type: string
 *           format: date
 *         profilePictureUrl:
 *           type: string
 *           example: "https://abc.com/pic1.jpg"
 *         profilePictureThumbnailUrl:
 *           type: string
 *           example: "https://abc.com/pic2.jpg"
 *         displayName:
 *           type: string
 *         publicProfilePictureThumbnailUrl:
 *           type: string
 *           example: "https://abc.com/pic3.jpg"
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
 *     description: Get the details of multiple users based on the provided conditions. Returns details of the user whose ID matches the one in the JWT if no specific userId is provided.
 *     tags: [1st]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional user ID to retrieve details for a specific user.
 *     responses:
 *       200:
 *         description: User details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/responses/UserDetailsObject'
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
      .isNumeric().withMessage('UserId must be a number.'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  (req, res, next) => {
    const userId = req.query && req.query.userId;
    const middleware = authorizeUser({ dom: '0', obj: 'mra_user_details', act: 'R', attrs: { where: { user_id: userId && parseInt(userId, 10) } } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const userDetailsArray = await db.getUserDetails(req.conditions.where);

      if (!userDetailsArray || userDetailsArray.length === 0) {
        return res.status(404).json({ message: 'User details not found' });
      }

      const decryptedDataArray = userDetailsArray.map(userDetails =>
        toLowerCamelCase(decryptObjectItems(userDetails, secretProperties))
      );
      return res.json(decryptedDataArray);
    } catch (err) {
      updateEventLog(req, err);
      return res.status(500).json({ message: err.message });
    }
  });

/**
 * @swagger
 * /v1/user_details:
 *   post:
 *     summary: Create user details
 *     description: Create details for the user whose ID matches the one in the JWT.
 *     tags: [1st]
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
 *               genderId:
 *                 type: integer
 *                 example: 1 
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               profilePictureUrl:
 *                 type: string
 *                 example: "https://abc.com/pic1.jpg"
 *               profilePictureThumbnailUrl:
 *                 type: string
 *                 example: "https://abc.com/pic2.jpg"
 *               displayName:
 *                 type: string
 *                 example: "Docky"
 *               publicProfilePictureThumbnailUrl:
 *                 type: string
 *                 example: "https://abc.com/pic3.jpg"
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
      .optional()
      .isString()
      .withMessage('First name must be a string.')
      .isLength({ max: 255 })
      .withMessage('First name must not exceed 255 characters.'),

    body('middleName')
      .optional()
      .isString()
      .withMessage('Middle name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Middle name must not exceed 255 characters.'),

    body('lastName')
      .optional()
      .isString()
      .withMessage('Last name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Last name must not exceed 255 characters.'),

    body('genderId')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Gender ID must be an integer between 1 and 10, inclusive.'),

    body('dateOfBirth')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/, 'i')
      .withMessage('Date of birth must be in YYYY-MM-DD format.')
      .custom(value => {
        return moment(value, 'YYYY-MM-DD', true).isValid();
      })
      .withMessage('Date of birth must be a valid date.'),

    body('profilePictureUrl')
      .optional()
      .isString()
      .withMessage('Profile picture URL must be a string.')
      .isURL()
      .withMessage('Profile picture URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Profile picture URL must not exceed 255 characters.'),

    body('profilePictureThumbnailUrl')
      .optional()
      .isString()
      .withMessage('Profile picture thumbnail URL must be a string.')
      .isURL()
      .withMessage('Profile picture thumbnail URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Profile picture thumbnail URL must not exceed 255 characters.'),

    body('displayName')
      .optional()
      .isString()
      .withMessage('Display name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Display name must not exceed 255 characters.'),

    body('publicProfilePictureThumbnailUrl')
      .optional()
      .isString()
      .withMessage('Public profile picture thumbnail URL must be a string.')
      .isURL()
      .withMessage('Public profile picture thumbnail URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Public profile picture thumbnail URL must not exceed 255 characters.')

  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  (req, res, next) => {
    const processedBody = toSnakeCase(req.body);
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
      const createdUserDetails = await db.createUserDetails(encryptObjectItems(userDetails, secretProperties));
      return res.status(201).json(toLowerCamelCase(decryptObjectItems(createdUserDetails, secretProperties)));
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
  });


/**
 * @swagger
 * /v1/user_details/{userId}:
 *   put:
 *     summary: Update user details
 *     description: Update details for the user whose ID matches the one in the JWT.
 *     tags: [1st]
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
 *               genderId:
 *                 type: integer
 *                 example: 2 
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               profilePictureUrl:
 *                 type: string
 *                 example: "https://abc.com/pic1.jpg"
 *               profilePictureThumbnailUrl:
 *                 type: string
 *                 example: "https://abc.com/pic2.jpg"
 *               displayName:
 *                 type: string
 *                 example: "Mocky"
 *               publicProfilePictureThumbnailUrl:
 *                 type: string
 *                 example: "https://abc.com/pic3.jpg"
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
      .optional()
      .isString()
      .withMessage('First name must be a string.')
      .isLength({ max: 255 })
      .withMessage('First name must not exceed 255 characters.'),

    body('middleName')
      .optional()
      .isString()
      .withMessage('Middle name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Middle name must not exceed 255 characters.'),

    body('lastName')
      .optional()
      .isString()
      .withMessage('Last name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Last name must not exceed 255 characters.'),

    body('genderId')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Gender ID must be an integer between 1 and 10, inclusive.'),

    body('dateOfBirth')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/, 'i')
      .withMessage('Date of birth must be in YYYY-MM-DD format.')
      .custom(value => {
        return moment(value, 'YYYY-MM-DD', true).isValid();
      })
      .withMessage('Date of birth must be a valid date.'),

    body('profilePictureUrl')
      .optional()
      .isString()
      .withMessage('Profile picture URL must be a string.')
      .isURL()
      .withMessage('Profile picture URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Profile picture URL must not exceed 255 characters.'),

    body('profilePictureThumbnailUrl')
      .optional()
      .isString()
      .withMessage('Profile picture thumbnail URL must be a string.')
      .isURL()
      .withMessage('Profile picture thumbnail URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Profile picture thumbnail URL must not exceed 255 characters.'),

    body('displayName')
      .optional()
      .isString()
      .withMessage('Display name must be a string.')
      .isLength({ max: 255 })
      .withMessage('Display name must not exceed 255 characters.'),

    body('publicProfilePictureThumbnailUrl')
      .optional()
      .isString()
      .withMessage('Public profile picture thumbnail URL must be a string.')
      .isURL()
      .withMessage('Public profile picture thumbnail URL must be a valid URL.')
      .isLength({ max: 255 })
      .withMessage('Public profile picture thumbnail URL must not exceed 255 characters.')

  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  (req, res, next) => {
    const processedBody = toSnakeCase(req.body);
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

      const updatedUserDetails = await db.updateUserDetails(req.conditions.where, encryptObjectItems(userDetails, secretProperties));

      if (!updatedUserDetails) {
        return res.status(404).json({ message: 'There is no record for this user in the user details table.' });
      }

      return res.status(200).json(toLowerCamelCase(decryptObjectItems(updatedUserDetails, secretProperties)));
    } catch (err) {
      updateEventLog(req, err);

      if (err.code === '23503') { // PostgreSQL foreign key violation error code
        return res.status(422).json({ message: 'Invalid foreign key value.', details: err.message });
      }

      return res.status(500).json({ message: err.message });
    }
  });


module.exports = router;
