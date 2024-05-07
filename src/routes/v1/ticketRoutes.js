const { body, oneOf } = require('express-validator');
const { toLowerCamelCase, toSnakeCase } = require('../../utils/converters');
const router = require('express').Router();
const db = require('../../utils/database');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { updateEventLog } = require('../../utils/logger');
const { authorizeUser, checkRequestValidity } = require('../../utils/validations');

/**
 * @swagger
 * components:
 *   request:
 *     Ticket:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 255
 *           example: "System Outage"
 *           description: "Title of the ticket"
 *         body:
 *           type: string
 *           description: "Detailed description of the ticket"
 *         customerId:
 *           type: integer
 *           example: 1
 *           description: "ID of the customer associated with this ticket"
 *         ticketCategoryId:
 *           type: integer
 *           example: 3
 *           description: "ID of the ticket category"
 *         isConfidential:
 *           type: boolean
 *           example: false
 *           description: "Indicates if the ticket is confidential"
 *         mediaUrls:
 *           type: array
 *           example: ["http://example.com/image1.jpg", "http://example.com/image2.jpg"]
 *           description: "JSON array of media URLs associated with the ticket"
 *         geoLatitude:
 *           type: number
 *           format: float
 *           example: 34.0522
 *           minimum: -90
 *           maximum: 90
 *           description: "Latitude coordinate of the ticket's location"
 *         geoLongitude:
 *           type: number
 *           format: float
 *           example: -118.2437
 *           minimum: -180
 *           maximum: 180
 *           description: "Longitude coordinate of the ticket's location"
 *         countryId:
 *           type: integer
 *           example: 1
 *           description: "The ID of the country, referencing mrag_countries"
 *         cityId:
 *           type: integer
 *           example: null
 *           description: "The ID of the city, referencing mrag_cities"
 *         cityName:
 *           type: string
 *           maxLength: 255
 *           example: "Calgary"
 *           description: "Name of the city if cityId is not provided"
 *         regionName:
 *           type: string
 *           maxLength: 255
 *           example: "Alberta"
 *           description: "Name of the region"
 *         street:
 *           type: string
 *           maxLength: 255
 *           example: "Main St"
 *           description: "Street name of the address"
 *         houseNumber:
 *           type: string
 *           maxLength: 30
 *           example: "1234"
 *           description: "House number in the street"
 *         unit:
 *           type: string
 *           maxLength: 50
 *           example: "Unit 5B"
 *           description: "Unit number of the apartment or suite"
 *         postalCode:
 *           type: string
 *           maxLength: 20
 *           example: "T3A0Z8"
 *           description: "Postal code of the address"
 *
 *   response:
 *     Ticket:
 *       type: object
 *       properties:
 *         ticketId:
 *           type: integer
 *           description: ID of the created ticket
 *         title:
 *           type: string
 *           description: Title of the ticket
 *         body:
 *           type: string
 *           description: Detailed description of the ticket
 *         customer:
 *           type: object
 *           description: Information of the customer associated with this ticket
 *           properties:
 *             customerId:
 *               type: integer
 *               example: 1
 *               description: ID of the customer associated with this ticket.
 *             customerName:
 *               type: string
 *               example: "Calgary CityHall"
 *               description: Name of the customer associated with this ticket.  
 *         ticketCategory:
 *           type: object
 *           description: Information of the ticket category
 *           properties:
 *             ticketCategoryId:
 *               type: integer
 *               example: 1
 *               description: ID of the ticket category.
 *             ticketCategoryName:
 *               type: string
 *               example: "Public Transportation Issues"
 *               description: Name of the ticket category. 
 *         isConfidential:
 *           type: boolean
 *           description: Indicates if the ticket is confidential
 *         mediaUrls:
 *           type: array
 *           items:
 *             type: string
 *             example: "http://example.com/image1.jpg"
 *           description: Array of media URLs associated with the ticket
 *         geoLatitude:
 *           type: number
 *           format: float
 *           description: Latitude coordinate of the ticket's location
 *         geoLongitude:
 *           type: number
 *           format: float
 *           description: Longitude coordinate of the ticket's location
 *         geoLocation:
 *           type: object
 *           description: Geospatial data point representing the ticket's location.
 *           properties:
 *             crs:
 *               type: object
 *               description: The Coordinate Reference System (CRS) for the geolocation data.
 *               properties:
 *                 type:
 *                   type: string
 *                   description: Type of CRS; typically 'name' indicating a named CRS.
 *                   example: "name"
 *                 properties:
 *                   type: object
 *                   description: Properties of the CRS.
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Name of the CRS used.
 *                       example: "EPSG:4326"
 *             type:
 *               type: string
 *               description: The type of geoJSON object, typically a 'Point' for a single geographic location.
 *               example: "Point"
 *             coordinates:
 *               type: array
 *               description: Array of geographical coordinates (longitude, latitude).
 *               items:
 *                 type: number
 *                 format: double
 *               example: [-118.2437, 34.0522]
 *         countryId:
 *           type: integer
 *           example: 1
 *           description: "The ID of the country, referencing mrag_countries"
 *         cityId:
 *           type: integer
 *           example: null
 *           description: "The ID of the city, referencing mrag_cities"
 *         cityName:
 *           type: string
 *           maxLength: 255
 *           example: "Calgary"
 *           description: "Name of the city if cityId is not provided"
 *         regionName:
 *           type: string
 *           maxLength: 255
 *           example: "AB"
 *           description: "Name of the region/state"
 *         street:
 *           type: string
 *           maxLength: 255
 *           example: "Varsity Dr. NW"
 *           description: "Street name of the address"
 *         houseNumber:
 *           type: string
 *           maxLength: 30
 *           example: "4515"
 *           description: "House number in the street"
 *         unit:
 *           type: string
 *           maxLength: 50
 *           example: "5B"
 *           description: "Unit number of the apartment or suite"
 *         postalCode:
 *           type: string
 *           maxLength: 20
 *           example: "T3A0Z8"
 *           description: "Postal code of the address"
 *         fullAddress:
 *           type: string
 *           example: "5B-4515 Varsity Dr. NW, Calgary T3A0Z8, AB, CA"
 *           description: "Generated full address"
 *         creator:
 *           type: object
 *           description: Information about the user who created the ticket.
 *           properties:
 *             userId:
 *               type: integer
 *               example: 1
 *               description: ID of the user who created the ticket.
 *             displayName:
 *               type: string
 *               example: "Alex"
 *               description: Display name of the user who created the ticket.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the ticket was created
 *         updator:
 *           type: object
 *           description: Information of the user who updated the ticket
 *           properties:
 *             userId:
 *               type: integer
 *               example: 1
 *               description: ID of the user who updated the ticket.
 *             displayName:
 *               type: string
 *               example: "Alex"
 *               description: Display name of the user who updated the ticket.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the ticket was updated
 *         publisher:
 *           type: object
 *           description: Information of the user who published the ticket
 *           properties:
 *             userId:
 *               type: integer
 *               example: 2
 *               description: ID of the user who published the ticket.
 *             displayName:
 *               type: string
 *               example: "Bob"
 *               description: Display name of the user who published the ticket.
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the ticket was published
 *         closedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the ticket was closed
 *         closeReason:
 *           type: string
 *           example: "Done"
 *           description: Reason that the ticket was closed
 * 
 *     UnauthorizedAccessInvalidTokenProvided:
 *       description: Access unauthorized due to invalid token
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Invalid token provided."
 * 
 *     ApiRateLimitExceeded:
 *       description: API rate limit has been exceeded
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "API rate limit exceeded."
 * 
 *     ServerInternalError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "An unexpected error occurred."
 */

/**
 * @swagger
 * /v1/ticket:
 *   post:
 *     summary: Create a new ticket
 *     description: Allows for the creation of a new ticket, associating it with user details and other metadata.
 *     tags: [2nd]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - creator
 *             allOf:
 *               - $ref: '#/components/request/Ticket'
 *               - type: object
 *                 required:
 *                   - creator
 *                 properties:
 *                   creator:
 *                     type: integer
 *                     example: 1
 *                     description: "The ID of the user creating the ticket"
 *     responses:
 *       201:
 *         description: Ticket created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/response/Ticket'
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
 *                         example: "Title must not exceed 255 characters."
 *                       param:
 *                         type: string
 *                         example: "title"
 *                       location:
 *                         type: string
 *                         example: "body"
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
 *                   example: "User is not authorized to create tickets."
 *       422:
 *         description: |
 *           Unprocessable Content. This can occur in different scenarios:
 *           - Duplicate record: Duplicate ticket detected.
 *           - Foreign key violation: Invalid foreign key value.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Duplicate ticket detected."
 *                 details:
 *                   type: string
 *                   example: "duplicate key value violates unique constraint 'mra_tickets_pkey'"
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.post('/ticket', apiRequestLimiter,
  [
    body('title')
      .notEmpty()
      .withMessage('Title is required.')
      .isString()
      .withMessage('Title must be a string.')
      .isLength({ max: 255 })
      .withMessage('Title must not exceed 255 characters.'),

    body('body')
      .optional()
      .isString()
      .withMessage('Body must be a string.'),

    body('customerId')
      .optional()
      .isInt({ gt: 0 })
      .withMessage('Customer ID must be an integer greater than 0.'),

    body('ticketCategoryId')
      .optional()
      .isInt({ gt: 0 })
      .withMessage('Ticket category ID must be an integer greater than 0.'),

    body('isConfidential')
      .optional()
      .isBoolean()
      .withMessage('Is confidential must be a boolean.'),

    body('mediaUrls')
      .optional()
      .isArray({ min: 1 }) // Ensure it's an array and not empty
      .withMessage('Media URLs must be a non-empty array.')
      .custom((urls) => {
        // Check each URL in the array
        urls.forEach(url => {
          if (typeof url !== 'string' || !/^https?:\/\/.+/i.test(url)) {
            throw new Error(`Invalid URL detected: ${url}`);
          }
        });
        return true;
      }),

    body('geoLatitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be a float between -90 and 90.'),

    body('geoLongitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be a float between -180 and 180.'),

    body('creator')
      .notEmpty()
      .isInt({ gt: 0 })
      .withMessage('Creator ID is required and must be an integer greater than 0.'),

    oneOf([
      [
        body('cityId').isEmpty(),
        body('cityName').isEmpty()
      ],
      [
        body('cityId').exists().isInt({ gt: 0 }).withMessage('City ID must be an integer greater than 0'),
        body('cityName').isEmpty()
      ],
      [
        body('cityId').isEmpty(),
        body('cityName').exists().isString().withMessage('City name must be a string')
      ]
    ], 'Either cityId or cityName must be provided, but not both, or both can be null.'),

    body('ticketId')
    .not().exists()
    .withMessage('ticketId should not be provided in the request.'),

    body('fullAddress')
    .not().exists()
    .withMessage('fullAddress should not be provided in the request.'),
  ],
  checkRequestValidity,
  async (req, res, next) => {
    const { customerId } = req.body;
    const isPrivateCustomer = await db.isPrivateCustomer(customerId);
    const domain = isPrivateCustomer ? String(customerId) : '0';
    const processedBody = toSnakeCase(req.body);
    const middleware = authorizeUser({ dom: domain, obj: 'mra_tickets', act: 'C', attrs: { set: processedBody } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const ticket = req.conditions.set;
      const createdTicket = await db.createTicket(ticket);
      if (!createdTicket) {
        throw new Error('Failed to create ticket.');
      }
      return res.status(201).json(toLowerCamelCase(createdTicket));
    } catch (err) {
      updateEventLog(req, err);

      const errorCode = err.original?.code;
      if (errorCode === '23505') {
        return res.status(422).json({ message: 'Duplicate ticket detected.', details: err.message });
      }
      if (errorCode === '23503') {
        return res.status(422).json({ message: 'Invalid foreign key value.', details: err.message });
      }
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
