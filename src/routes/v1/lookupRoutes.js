const express = require('express');
const { query } = require('express-validator');
const db = require('../../utils/database');
const { checkRequestValidity } = require('../../utils/validations');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { toLowerCamelCase } = require('../../utils/converters');

const router = express.Router();

/**
 * @swagger
 * /v1/gender_types:
 *   get:
 *     summary: Retrieve gender types
 *     description: Get the list of gender types with optional pagination.
 *     tags: [1st]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number of the gender types to retrieve.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Maximum number of gender types to return in one response.
 *     responses:
 *       200:
 *         description: Gender types retrieved successfully, with an indicator if additional pages are available.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       genderId:
 *                         type: integer
 *                         description: Unique identifier for the gender type.
 *                         example: 1
 *                       genderName:
 *                         type: string
 *                         description: Name of the gender type.
 *                         example: "Male"
 *                       sortOrder:
 *                         type: integer
 *                         description: Numeric value used to determine the display order.
 *                         example: 1
 *                 hasMore:
 *                   type: boolean
 *                   description: Indicates if more data is available beyond the current page.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       404:
 *         description: Gender types not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Gender types not found.
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/gender_types', apiRequestLimiter,
  [
    query('page')
      .optional({ checkFalsy: true })
      .isNumeric().withMessage('Page must be a number')
      .toInt(),

    query('limit')
      .optional({ checkFalsy: true })
      .isNumeric().withMessage('Limit must be a number')
      .toInt(),
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
  async (req, res) => {
    try {
      const genderTypesArray = await db.getGenderTypes({}, req.pagination);

      if (!genderTypesArray || genderTypesArray.length === 0) {
        return res.status(404).json({ message: 'Gender types not found' });
      }

      // Determine if there are more items beyond the current page
      const hasMore = genderTypesArray.length > (req.pagination.limit - 1);
      const results = hasMore ? genderTypesArray.slice(0, -1) : genderTypesArray; // Remove the extra item if present

      return res.json({ data: results.map(item => toLowerCamelCase(item)), hasMore });
    } catch (err) {
      console.error('Error fetching gender types:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/ticket_categories:
 *   get:
 *     summary: Retrieve ticket categories
 *     description: Get the list of ticket categories with optional pagination and search filters.
 *     tags: [1st]
 *     parameters:
 *       - in: query
 *         name: ticketTitle
 *         required: false
 *         schema:
 *           type: string
 *         description: The title of the ticket to search for.
 *       - in: query
 *         name: latitude
 *         required: false
 *         schema:
 *           type: number
 *         description: Latitude for geolocation search.
 *       - in: query
 *         name: longitude
 *         required: false
 *         schema:
 *           type: number
 *         description: Longitude for geolocation search.
 *       - in: query
 *         name: customerId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Customer ID for filtering ticket categories.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number of the ticket categories to retrieve.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Maximum number of ticket categories to return in one response.
 *     responses:
 *       200:
 *         description: Ticket categories retrieved successfully, with an indicator if additional pages are available.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ticketCategoryId:
 *                         type: integer
 *                         description: Unique identifier for the ticket category.
 *                         example: 1
 *                       ticketCategoryName:
 *                         type: string
 *                         description: Name of the ticket category.
 *                         example: "Technical Support"
 *                       description:
 *                         type: string
 *                         description: Description of the ticket category.
 *                         example: "Support for technical issues."
 *                 hasMore:
 *                   type: boolean
 *                   description: Indicates if more data is available beyond the current page.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedAccessInvalidTokenProvided'
 *       404:
 *         description: Ticket categories not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ticket categories not found.
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/ticket_categories', apiRequestLimiter,
  [
    query('ticketTitle')
      .optional({ checkFalsy: true })
      .isString().withMessage('Ticket title must be a string'),
    
    query('latitude')
      .optional({ checkFalsy: true })
      .isFloat().withMessage('Latitude must be a number'),

    query('longitude')
      .optional({ checkFalsy: true })
      .isFloat().withMessage('Longitude must be a number'),

    query('customerId')
      .optional({ checkFalsy: true })
      .isNumeric().withMessage('Customer ID must be a number')
      .toInt(),

    query('page')
      .optional({ checkFalsy: true })
      .isNumeric().withMessage('Page must be a number')
      .toInt(),

    query('limit')
      .optional({ checkFalsy: true })
      .isNumeric().withMessage('Limit must be a number')
      .toInt(),
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
  async (req, res) => {
    try {
      const { ticketTitle, latitude, longitude, customerId } = req.query;
      const ticketCategoriesArray = await db.getTicketCategories(ticketTitle, latitude, longitude, customerId, req.pagination);

      if (!ticketCategoriesArray || ticketCategoriesArray.length === 0) {
        return res.status(404).json({ message: 'Ticket categories not found' });
      }

      // Determine if there are more items beyond the current page
      const hasMore = ticketCategoriesArray.length > (req.pagination.limit - 1);
      const results = hasMore ? ticketCategoriesArray.slice(0, -1) : ticketCategoriesArray; // Remove the extra item if present

      return res.json({ data: results.map(item => toLowerCamelCase(item)), hasMore });
    } catch (err) {
      console.error('Error fetching ticket categories:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
