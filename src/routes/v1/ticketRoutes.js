const { body, validationResult } = require('express-validator');
const router = require('express').Router();
const db = require('../../utils/database');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { updateEventLog } = require('../../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     TicketResponse:
 *       type: object
 *       properties:
 *         ticket_id:
 *           type: integer
 *           description: ID of the created ticket
 *         title:
 *           type: string
 *           description: Title of the ticket
 *         body:
 *           type: string
 *           description: Detailed description of the ticket
 *         customer_id:
 *           type: integer
 *           description: ID of the customer associated with this ticket
 *         ticket_category_id:
 *           type: integer
 *           description: ID of the ticket category
 *         is_confidential:
 *           type: boolean
 *           description: Indicates if the ticket is confidential
 *         media_urls:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of media URLs associated with the ticket
 *         latitude:
 *           type: number
 *           format: float
 *           description: Latitude coordinate of the ticket's location
 *         longitude:
 *           type: number
 *           format: float
 *           description: Longitude coordinate of the ticket's location
 *         geo_location:
 *           type: string
 *           description: Geospatial data point representing the ticket's location
 *         creator:
 *           type: integer
 *           description: ID of the user who created the ticket
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the ticket was created
 *   responses:
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
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 example: "System Outage"
 *                 description: "Title of the ticket"
 *               body:
 *                 type: string
 *                 description: "Detailed description of the ticket"
 *               customer_id:
 *                 type: integer
 *                 example: 1
 *                 description: "ID of the customer associated with this ticket"
 *               ticket_category_id:
 *                 type: integer
 *                 example: 3
 *                 description: "ID of the ticket category"
 *               is_confidential:
 *                 type: boolean
 *                 example: false
 *                 description: "Indicates if the ticket is confidential"
 *               media_urls:
 *                 type: string
 *                 example: '["http://example.com/image1.jpg", "http://example.com/image2.jpg"]'
 *                 description: "JSON array of media URLs associated with the ticket"
 *               geo_latitude:
 *                 type: number
 *                 format: float
 *                 example: 34.0522
 *                 minimum: -90
 *                 maximum: 90
 *                 description: "Latitude coordinate of the ticket's location"
 *               geo_longitude:
 *                 type: number
 *                 format: float
 *                 example: -118.2437
 *                 minimum: -180
 *                 maximum: 180
 *                 description: "Longitude coordinate of the ticket's location"
 *               creator:
 *                 type: integer
 *                 example: 1
 *                 description: "ID of the user who created the ticket"
 *     responses:
 *       201:
 *         description: Ticket created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketResponse'
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

    body('customer_id')
      .optional()
      .isInt({ gt: 0 })
      .withMessage('Customer ID must be an integer greater than 0.'),

    body('ticket_category_id')
      .optional()
      .isInt({ gt: 0 })
      .withMessage('Ticket category ID must be an integer greater than 0.'),

    body('is_confidential')
      .optional()
      .isBoolean()
      .withMessage('Is confidential must be a boolean.'),

    body('media_urls')
      .optional()
      .custom((value) => {
        // This custom validator presumes you expect an array of URLs in JSON format
        if (typeof value === 'string') {
          try {
            const urls = JSON.parse(value);
            if (!Array.isArray(urls) || !urls.every(url => typeof url === 'string' && /^https?:\/\/.+/.test(url))) {
              throw new Error('All URLs must be valid.');
            }
          } catch (err) {
            throw new Error('Media URLs must be a valid JSON array of URLs.');
          }
        } else {
          throw new Error('Media URLs must be a stringified JSON.');
        }
        return true;
      }),

    body('geo_latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be a float between -90 and 90.'),

    body('geo_longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be a float between -180 and 180.'),

    body('creator')
      .notEmpty()
      .isInt({ gt: 0 })
      .withMessage('Creator ID is required and must be an integer greater than 0.')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  async (req, res) => {
    try {
      const ticket = req.body;
      const createdTicket = await db.createTicket(ticket);
      if (!createdTicket) {
        throw new Error('Failed to create ticket.');
      }
      return res.status(201).json(createdTicket);
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
