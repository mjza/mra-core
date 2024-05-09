const { query, body, oneOf, param } = require('express-validator');
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
 * /v1/tickets:
 *   get:
 *     summary: Retrieve a list of tickets
 *     description: Fetches a list of tickets based on various filters and pagination. It supports searching across multiple fields and date ranges.
 *     tags: [2nd]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of tickets to return per page.
 *       - in: query
 *         name: ticketId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by specific ticket ID.
 *       - in: query
 *         name: customerId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by customer ID.
 *       - in: query
 *         name: ticketCategoryId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by ticket category ID.
 *       - in: query
 *         name: cityId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by city ID.
 *       - in: query
 *         name: countryId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by country ID.
 *       - in: query
 *         name: creator
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by creator's user ID.
 *       - in: query
 *         name: updator
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by updator's user ID.
 *       - in: query
 *         name: publisher
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter tickets by publisher's user ID.
 *       - in: query
 *         name: createdAtAfter
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets created after this date.
 *       - in: query
 *         name: createdAtBefore
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets created before this date.
 *       - in: query
 *         name: updatedAtAfter
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets updated after this date.
 *       - in: query
 *         name: updatedAtBefore
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets updated before this date.
 *       - in: query
 *         name: publishedAtAfter
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets published after this date.
 *       - in: query
 *         name: publishedAtBefore
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets published before this date.
 *       - in: query
 *         name: closedAtAfter
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets closed after this date.
 *       - in: query
 *         name: closedAtBefore
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets closed before this date.
 *       - in: query
 *         name: isConfidential
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Filter tickets by confidentiality.
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search term to apply across specified search fields.
 *       - in: query
 *         name: searchFields
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma-separated fields to apply the search term to, such as title, body, street, etc.
 *     responses:
 *       200:
 *         description: A list of tickets.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/response/Ticket'
 *                 hasMore:
 *                   type: boolean
 *                   description: Indicates if more data is available beyond the current page.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/tickets', apiRequestLimiter,
  [
    query('page', 'Page must be a number').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('limit', 'Limit must be a number').optional({ checkFalsy: true }).isNumeric().toInt(),

    query('ticketId', 'TicketId must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('customerId', 'CustomerId must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('ticketCategoryId', 'TicketCategoryId must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('cityId', 'CityId must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('countryId', 'CountryId must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('creator', 'Creator must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('updator', 'Updator must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),
    query('publisher', 'Publisher must be a number.').optional({ checkFalsy: true }).isNumeric().toInt(),

    query('createdAtAfter', 'CreatedAtAfter must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('createdAtBefore', 'CreatedAtBefore must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('updatedAtAfter', 'UpdatedAtAfter must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('updatedAtBefore', 'UpdatedAtBefore must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('publishedAtAfter', 'PublishedAtAfter must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('publishedAtBefore', 'PublishedAtBefore must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('closedAtAfter', 'ClosedAtAfter must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),
    query('closedAtBefore', 'ClosedAtBefore must be a date in YYYY-MM-DD format').optional({ checkFalsy: true }).isISO8601(),

    query('isConfidential', 'IsConfidential must be either true or false').optional({ checkFalsy: true }).isBoolean().toBoolean(),

    query('search', 'Search must be a non-empty string.').optional({ checkFalsy: true }).isString(),
    query('searchCaseSensitive', 'SearchCaseSensitive must be either true or false').optional({ checkFalsy: true }).isBoolean().toBoolean(),
    query('searchFields', 'SearchFields must be a valid comma-separated list of fields [title, body, street, houseNumber, unit, cityName, regionName, postalCode, fullAddress, closeReason]')
      .optional({ checkFalsy: true })
      .custom((value) => {
        const allowedFields = ['title', 'body', 'street', 'houseNumber', 'unit', 'cityName', 'regionName', 'postalCode', 'fullAddress', 'closeReason'];
        const fields = value.split(',').map(field => field.trim());
        return fields.every(field => allowedFields.includes(field));
      }),
  ],
  checkRequestValidity,
  (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    req.pagination = {
      limit: limit + 1,
      offset: (page - 1) * limit
    };

    // example: ?order=createdAt,DESC;title,ASC
    const order = req.query.order
      ? req.query.order.split(';').map(pair => {
        const [field, direction] = pair.split(',');
        return [toSnakeCase(field), direction];
      })
      : [['created_at', 'DESC']];

    req.order = order;

    next();
  },
  async (req, res, next) => {
    let where = {};

    const search = req.query.search;
    const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['title', 'body', 'street', 'houseNumber', 'unit', 'cityName', 'regionName', 'postalCode', 'fullAddress', 'closeReason'];
    const searchCaseSensitive = req.query.searchCaseSensitive === true ? 'Sequelize.Op.like' : 'Sequelize.Op.iLike'
    if (search && searchFields.length) {
      where = {
        ['Sequelize.Op.or']: searchFields.map(field => ({
          [toSnakeCase(field)]: { [searchCaseSensitive]: `%${search}%` }
        }))
      };
    }

    const isConfidential = req.query.isConfidential;
    if (isConfidential) {
      where['is_confidential'] = isConfidential === true;
    }

    const filters = ['ticketId', 'ticketCategoryId', 'customerId', 'cityId', 'countryId', 'creator', 'updator', 'publisher'];
    filters.forEach(filter => {
      if (req.query[filter]) {
        where[toSnakeCase(filter)] = parseInt(req.query[filter], 10);
      }
    });

    const dateFields = ['createdAt', 'updatedAt', 'publishedAt', 'closedAt'];
    dateFields.forEach(field => db.addDateRangeFilter(where, req.query, field));

    const customerId = req.query.customerId;
    const isPrivateCustomer = await db.isPrivateCustomer(customerId);
    const domain = isPrivateCustomer ? String(customerId) : '0';
    const middleware = authorizeUser({ dom: domain, obj: 'mra_tickets', act: 'R', attrs: { where } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const ticketsArray = await db.getTickets(req.conditions.where, req.pagination, req.order);

      // Determine if there are more items beyond the current page
      const hasMore = ticketsArray.length > (req.pagination.limit - 1);
      const results = hasMore ? ticketsArray.slice(0, -1) : ticketsArray; // Remove the extra item if present

      res.json({ hasMore, data: results.map(ticket => toLowerCamelCase(ticket)) });
    } catch (err) {
      updateEventLog(req, err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/tickets:
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
 *             $ref: '#/components/request/Ticket'
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
 *           - Foreign key violation: Invalid foreign key value.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid foreign key value."
 *                 details:
 *                   type: string
 *                   example: "insert or update on table \"mra_tickets\" violates foreign key constraint \"mra_tickets_ticket_category_id_fkey\""
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.post('/tickets', apiRequestLimiter,
  [
    body('title')
      .notEmpty().withMessage('Title is required.')
      .isString().withMessage('Title must be a string.')
      .isLength({ max: 255 }).withMessage('Title must not exceed 255 characters.'),
    body('body', 'Body must be a string.').optional().isString(),
    body('customerId', 'Customer ID must be an integer greater than 0.').optional().isInt({ gt: 0 }),
    body('ticketCategoryId', 'Ticket category ID must be an integer greater than 0.').optional().isInt({ gt: 0 }),
    body('isConfidential', 'Is confidential must be a boolean.').optional().isBoolean(),

    body('mediaUrls', 'Media URLs must be a non-empty array.')
      .optional()
      .isArray({ min: 1 }) // Ensure it's an array and not empty
      .custom((urls) => {
        // Check each URL in the array
        urls.forEach(url => {
          if (typeof url !== 'string' || !/^https?:\/\/.+/i.test(url)) {
            throw new Error(`Invalid URL detected: ${url}`);
          }
        });
        return true;
      }),

    body('geoLatitude', 'Latitude must be a float between -90 and 90.').optional().isFloat({ min: -90, max: 90 }),
    body('geoLongitude', 'Longitude must be a float between -180 and 180.').optional().isFloat({ min: -180, max: 180 }),

    oneOf([
      [
        body('cityId').isEmpty(),
        body('cityName').isEmpty()
      ],
      [
        body('cityId', 'City ID must be an integer greater than 0').exists().isInt({ gt: 0 }),
        body('cityName').isEmpty()
      ],
      [
        body('cityId').isEmpty(),
        body('cityName', 'City name must be a string').exists().isString()
      ]
    ], 'Either cityId or cityName must be provided, but not both, or both can be null.'),

    body('ticketId', 'ticketId should not be provided in the request.').not().exists(),
    body('fullAddress', 'fullAddress should not be provided in the request.').not().exists(),
    body('creator', 'Creator is set automatically and should not be provided in the request.').not().exists(),
    body('updator', 'Updator is set automatically and should not be provided in the request.').not().exists(),
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
      if (errorCode === '23503') {
        return res.status(422).json({ message: 'Invalid foreign key value.', details: err.message });
      }
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/tickets/{ticketId}:
 *   put:
 *     summary: Update an existing ticket
 *     description: Allows updating the details of an existing ticket, such as title, body, or metadata.
 *     tags: [2nd]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ticketId
 *         in: path
 *         required: true
 *         description: The ID of the ticket to be updated.
 *         type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             $ref: '#/components/request/Ticket'
 *     responses:
 *       200:
 *         description: Ticket updated successfully.
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
 *           - Foreign key violation: Invalid foreign key value.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid foreign key value."
 *                 details:
 *                   type: string
 *                   example: "insert or update on table \"mra_tickets\" violates foreign key constraint \"mra_tickets_ticket_category_id_fkey\""
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.put('/tickets/:ticketId', apiRequestLimiter,
  [
    param('ticketId')
      .notEmpty().withMessage('Ticket ID is required.')
      .isInt().withMessage('Ticket ID must be an integer.')
      .toInt(),

    body('title')
      .optional()
      .isString().withMessage('Title must be a string.')
      .isLength({ max: 255 }).withMessage('Title must not exceed 255 characters.'),
    body('body', 'Body must be a string.').optional().isString(),
    body('customerId', 'Customer ID must be an integer greater than 0.').optional().isInt({ gt: 0 }),
    body('ticketCategoryId', 'Ticket category ID must be an integer greater than 0.').optional().isInt({ gt: 0 }),
    body('isConfidential', 'Is confidential must be a boolean.').optional().isBoolean(),

    body('mediaUrls', 'Media URLs must be a non-empty array.')
      .optional()
      .isArray({ min: 1 })
      .custom((urls) => {
        urls.forEach(url => {
          if (typeof url !== 'string' || !/^https?:\/\/.+/i.test(url)) {
            throw new Error(`Invalid URL detected: ${url}`);
          }
        });
        return true;
      }),

    body('geoLatitude', 'Latitude must be a float between -90 and 90.').optional().isFloat({ min: -90, max: 90 }),
    body('geoLongitude', 'Longitude must be a float between -180 and 180.').optional().isFloat({ min: -180, max: 180 }),

    oneOf([
      [
        body('cityId').isEmpty(),
        body('cityName').isEmpty()
      ],
      [
        body('cityId', 'City ID must be an integer greater than 0').exists().isInt({ gt: 0 }),
        body('cityName').isEmpty()
      ],
      [
        body('cityId').isEmpty(),
        body('cityName', 'City name must be a string').exists().isString()
      ]
    ], 'Either cityId or cityName must be provided, but not both, or both can be null.'),

    body('ticketId', 'ticketId should not be provided in the request body.').not().exists(),
    body('fullAddress', 'fullAddress should not be provided in the request body.').not().exists(),
    body('creator', 'Creator is set automatically and should not be provided in the request.').not().exists(),
    body('updator', 'Updator is set automatically and should not be provided in the request.').not().exists(),
  ],
  checkRequestValidity,
  async (req, res, next) => {
    const { ticketId } = req.params;
    const where = { ticket_id: ticketId };

    const { customerId } = req.body;
    const isPrivateCustomer = await db.isPrivateCustomer(customerId);
    const domain = isPrivateCustomer ? String(customerId) : '0';
    const processedBody = toSnakeCase(req.body);
    const middleware = authorizeUser({ dom: domain, obj: 'mra_tickets', act: 'U', attrs: { set: processedBody, where } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const ticket = req.conditions.set;
      const where = req.conditions.where;

      const updatedTicket = await db.updateTicket(where, ticket);
      if (!updatedTicket) {
        throw new Error('Failed to update ticket.');
      }
      return res.status(200).json(toLowerCamelCase(updatedTicket));
    } catch (err) {
      updateEventLog(req, err);

      const errorCode = err.original?.code;
      if (errorCode === '23503') {
        return res.status(422).json({ message: 'Invalid foreign key value.', details: err.message });
      }
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/tickets/{ticketId}:
 *   delete:
 *     summary: Delete a ticket
 *     description: Deletes a ticket by its unique ID if the requesting user has the required permissions.
 *     tags: [2nd]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the ticket to delete.
 *     responses:
 *       204:
 *         description: The ticket has been deleted successfully.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       403:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User is not authorized to delete ticket."
 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No ticket found with the specified ticketId."
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */

router.delete('/tickets/:ticketId', apiRequestLimiter,
  [
    param('ticketId')
      .notEmpty().withMessage('Ticket ID is required as a parameter.')
      .isInt().withMessage('Ticket ID must be an integer.')
      .toInt(),
  ],
  checkRequestValidity,
  async (req, res, next) => {
    const { ticketId } = req.params;
    const where = { ticket_id: ticketId };

    const tickets = await db.getTickets(where, { limit: 1, offset: 0 });    
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ message: 'No ticket found with the specified ticketId.' });
    }

    const { customer_id } = tickets[0].customer;
    const isPrivateCustomer = await db.isPrivateCustomer(customer_id);
    const domain = isPrivateCustomer ? String(customer_id) : '0';
    const middleware = authorizeUser({ dom: domain, obj: 'mra_tickets', act: 'D', attrs: { where } });
    middleware(req, res, next);
  },
  async (req, res) => {
    try {
      const where = req.conditions.where;

      const result = await db.deleteTicket(where);
      if (!result) {
        return res.status(404).json({ message: 'No ticket found with the specified ticketId.' });
      }

      return res.status(204).send();
    } catch (err) {
      updateEventLog(req, err);
      return res.status(500).json({ message: 'Failed to delete the ticket due to an internal error.', error: err.message });
    }
  }
);

module.exports = router;