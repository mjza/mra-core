const express = require('express');
const { query } = require('express-validator');
const db = require('../../utils/database');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { toLowerCamelCase } = require('../../utils/converters');
const { authorizeUser, checkRequestValidity } = require('../../utils/validations');
const router = express.Router();
module.exports = router;

/**
 * @swagger
 * /v1/countries:
 *   get:
 *     summary: Retrieve a list of countries
 *     description: Get a paginated list of countries with optional filters.
 *     tags: [4th]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isoCode
 *         schema:
 *           type: string
 *         description: ISO code of the country to filter by.
 *       - in: query
 *         name: countryName
 *         schema:
 *           type: string
 *         description: Name of the country to filter by.
 *       - in: query
 *         name: isSupported
 *         schema:
 *           type: boolean
 *         description: Filter by whether the country is supported.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Maximum number of countries to return.
 *     responses:
 *       200:
 *         description: A list of countries retrieved successfully.
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
 *                       country_id:
 *                         type: integer
 *                         description: Unique identifier for the country.
 *                         example: 85633041
 *                       country_name:
 *                         type: string
 *                         description: Name of the country.
 *                         example: "Canada"
 *                       iso_code:
 *                         type: string
 *                         description: ISO 3166-1 alpha-2 country code.
 *                         example: "CA"
 *                       iso_long_code:
 *                         type: string
 *                         description: ISO 3166-1 alpha-3 country code.
 *                         example: "CAN"
 *                       dial_code:
 *                         type: string
 *                         description: Dial code for the country, including the plus sign.
 *                         example: "1"
 *                       languages:
 *                         type: string
 *                         description: Languages spoken in the country.
 *                         example: "en-CA,fr-CA,iu"
 *                       is_supported:
 *                         type: boolean
 *                         description: Whether the country is supported.
 *                         example: true
 *                 hasMore:
 *                   type: boolean
 *                   description: Indicates if more data is available beyond the current page.
 *                   example: false
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
 *                       type: 
 *                         type: string
 *                         description: The type of validation error (e.g., "field").
 *                         example: "field"
 *                       value: 
 *                         type: string
 *                         description: The value that caused the validation error.
 *                         example: "0"
 *                       msg:
 *                         type: string
 *                         description: The error message describing the validation failure.
 *                         example: "Page must be a positive integer"
 *                       path:
 *                         type: string
 *                         description: The field or parameter that failed validation.
 *                         example: "page"
 *                       location:
 *                         type: string
 *                         description: The location of the parameter (e.g., "query", "body", "params").
 *                         example: "query"
 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No countries found
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/countries', apiRequestLimiter,
  [
    query('isoCode')
      .optional()
      .isString().withMessage('Country ISO code must be a string')
      .matches(/^[A-Za-z_]+$/).withMessage('Country code can only contain letters and underscores')
      .trim()
      .toUpperCase(),

    query('countryName')
      .optional()
      .isString().withMessage('Country name must be a string')
      .trim(),

    query('isSupported')
      .optional()
      .isBoolean().withMessage('isSupported must be a boolean')
      .toBoolean(),

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
    const page = req.query.page;
    const limit = req.query.limit;
    // Calculate pagination values
    req.pagination = {
      limit: limit + 1,
      offset: (page - 1) * limit
    };
    next();
  },
  (req, res, next) => {
    const { isoCode, countryName, isSupported } = req.query;
    const where = { is_valid: true };
    if (isoCode) 
      where.iso_code = isoCode;
    if (countryName) 
      where.country_name = { ['Sequelize.Op.iLike']: `%${countryName}%` };
    if (isSupported !== undefined) 
      where.is_supported = isSupported;
    
    const middleware = authorizeUser({ dom: '0', obj: 'mrag_countries', act: 'R', attrs: { where } });
    middleware(req, res, next);
  },
  async (req, res) => {    
    const { limit } = req.query;

    try {
      const countries = await db.getCountries(req.conditions.where, req.pagination);

      if (!countries || countries.length === 0) {
        return res.status(404).json({ message: 'No countries found' });
      }

      const hasMore = countries.length > limit;
      const data = hasMore ? countries.slice(0, limit) : countries;

      return res.json({data, hasMore});
    } catch (err) {
      console.error('Error fetching countries:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/addresses:
 *   get:
 *     summary: Retrieve address data
 *     description: Get address data based on longitude and latitude.
 *     tags: [4th]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude of the location to retrieve address data.
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude of the location to retrieve address data.
 *     responses:
 *       200:
 *         description: Address data retrieved successfully.
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
 *                       id:
 *                         type: string
 *                         description: Unique identifier for the address.
 *                         example: "734f535bebd6ae6709cc"
 *                       geoLatitude:
 *                         type: number
 *                         description: Latitude of the address.
 *                         example: 51.07462
 *                       geoLongitude:
 *                         type: number
 *                         description: Longitude of the address.
 *                         example: -114.12839
 *                       streetName:
 *                         type: string
 *                         description: Name of the street.
 *                         example: "UNIVERSITY"
 *                       streetType:
 *                         type: string
 *                         description: Type of the street.
 *                         example: "DR"
 *                       streetQuad:
 *                         type: string
 *                         description: Street quadrant.
 *                         example: "NW"
 *                       streetFullName:
 *                         type: string
 *                         description: Full name of the street.
 *                         example: "UNIVERSITY DR NW"
 *                       streetNo:
 *                         type: string
 *                         description: Street number.
 *                         example: "2500A"
 *                       houseNumber:
 *                         type: integer
 *                         description: House number.
 *                         example: 2500
 *                       houseAlpha:
 *                         type: string
 *                         description: House alpha.
 *                         example: "A"
 *                       unit:
 *                         type: string
 *                         description: Unit number.
 *                         example: 406
 *                       city:
 *                         type: string
 *                         description: City name.
 *                         example: "Calgary"
 *                       region:
 *                         type: string
 *                         description: Region name.
 *                         example: "Alberta"
 *                       postalCode:
 *                         type: string
 *                         description: Postal code.
 *                         example: "T2N 1N4"
 *                       fullAddress:
 *                         type: string
 *                         description: Full address.
 *                         example: "2500 UNIVERSITY DR NW"
 *                       countryCode:
 *                         type: string
 *                         description: ISO code of the country.
 *                         example: "CA"
 *                       countryName:
 *                         type: string
 *                         description: Name of the country.
 *                         example: "Canada"
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
 *                       type: 
 *                         type: string
 *                         description: The type of validation error (e.g., "field").
 *                         example: "field"
 *                       value: 
 *                         type: string
 *                         description: The value that caused the validation error.
 *                         example: "190"
 *                       msg:
 *                         type: string
 *                         description: The error message describing the validation failure.
 *                         example: "Longitude must be a number between -180 and 180"
 *                       path:
 *                         type: string
 *                         description: The field or parameter that failed validation.
 *                         example: "longitude"
 *                       location:
 *                         type: string
 *                         description: The location of the parameter (e.g., "query", "body", "params").
 *                         example: "query"

 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address data not found
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/addresses', apiRequestLimiter,
  [
    query('longitude')
      .exists().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a number between -180 and 180')
      .toFloat(),
  
    query('latitude')
      .exists().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a number between -90 and 90')
      .toFloat(),
  ],  
  checkRequestValidity,
  (req, res, next) => {    
    const middleware = authorizeUser({ dom: '0', obj: 'mrag_addresses', act: 'R', attrs: {} });
    middleware(req, res, next);
  },
  async (req, res) => {
    const longitude = req.query.longitude;
    const latitude = req.query.latitude;

    try {
      const addressDataArray = await db.getAddressData(longitude, latitude);

      if (!addressDataArray || addressDataArray.length === 0) {
        return res.status(404).json({ message: 'Address data not found' });
      }

      return res.json({data: addressDataArray.map(item => toLowerCamelCase(item))});
    } catch (err) {
      console.error('Error fetching address data:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/location:
 *   get:
 *     summary: Retrieve location data
 *     description: Get location data including country, state, and city based on longitude and latitude.
 *     tags: [4th]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude of the location to retrieve location data.
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude of the location to retrieve location data.
 *     responses:
 *       200:
 *         description: Location data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     countryId:
 *                       type: integer
 *                       description: Unique identifier for the country.
 *                       example: 85633041
 *                     countryCode:
 *                       type: string
 *                       description: ISO code of the country.
 *                       example: "CA"
 *                     countryName:
 *                       type: string
 *                       description: Name of the country.
 *                       example: "Canada"
 *                     stateId:
 *                       type: integer
 *                       description: Unique identifier for the state.
 *                       example: 85682091
 *                     state:
 *                       type: string
 *                       description: Name of the state.
 *                       example: "Alberta"
 *                     cityId:
 *                       type: integer
 *                       description: Unique identifier for the city.
 *                       example: 890458845
 *                     city:
 *                       type: string
 *                       description: Name of the city.
 *                       example: "Calgary"
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
 *                       type: 
 *                         type: string
 *                         description: The type of validation error (e.g., "field").
 *                         example: "field"
 *                       value: 
 *                         type: string
 *                         description: The value that caused the validation error.
 *                         example: "190"
 *                       msg:
 *                         type: string
 *                         description: The error message describing the validation failure.
 *                         example: "Longitude must be a number between -180 and 180"
 *                       path:
 *                         type: string
 *                         description: The field or parameter that failed validation.
 *                         example: "longitude"
 *                       location:
 *                         type: string
 *                         description: The location of the parameter (e.g., "query", "body", "params").
 *                         example: "query"
 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Location data not found
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/location', apiRequestLimiter,
  [
    query('longitude')
      .exists().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a number between -180 and 180')
      .toFloat(),
  
    query('latitude')
      .exists().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a number between -90 and 90')
      .toFloat(),
  ],
  checkRequestValidity,
  (req, res, next) => {    
    const middleware = authorizeUser({ dom: '0', obj: 'mrag_addresses', act: 'R', attrs: {} });
    middleware(req, res, next);
  },
  async (req, res) => {
    const longitude = req.query.longitude;
    const latitude = req.query.latitude;

    try {
      const locationData = await db.getLocationData(longitude, latitude);

      if (!locationData) {
        return res.status(404).json({ message: 'Location data not found' });
      }

      return res.json({data: toLowerCamelCase(locationData)});
    } catch (err) {
      console.error('Error fetching location data:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/statesByCountryCode:
 *   get:
 *     summary: Retrieve states by country code
 *     description: Get all states within a country using the country's ISO code.
 *     tags: [4th]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: countryCode
 *         required: true
 *         schema:
 *           type: string
 *         description: ISO code of the country to retrieve states for.
 *     responses:
 *       200:
 *         description: States retrieved successfully.
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
 *                       stateId:
 *                         type: integer
 *                         description: Unique identifier for the state.
 *                         example: 85682091
 *                       stateName:
 *                         type: string
 *                         description: Name of the state.
 *                         example: "Alberta"
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
 *                       type: 
 *                         type: string
 *                         description: The type of validation error (e.g., "field").
 *                         example: "field"
 *                       value: 
 *                         type: string
 *                         description: The value that caused the validation error.
 *                         example: "c2"
 *                       msg:
 *                         type: string
 *                         description: The error message describing the validation failure.
 *                         example: "Country code can only contain letters and underscores"
 *                       path:
 *                         type: string
 *                         description: The field or parameter that failed validation.
 *                         example: "isoCode"
 *                       location:
 *                         type: string
 *                         description: The location of the parameter (e.g., "query", "body", "params").
 *                         example: "query"
 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: States not found
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/statesByCountryCode', apiRequestLimiter,
  [
    query('countryCode')
      .exists().withMessage('Country code is required')
      .isString().withMessage('Country code must be a string')
      .matches(/^[A-Za-z_]+$/).withMessage('Country code can only contain letters and underscores')
      .trim()
      .toUpperCase(),
  ],
  checkRequestValidity,
  (req, res, next) => {    
    const middleware = authorizeUser({ dom: '0', obj: 'mrag_addresses', act: 'R', attrs: {} });
    middleware(req, res, next);
  },
  async (req, res) => {
    const countryCode = req.query.countryCode;

    try {
      const states = await db.getStatesByCountryCode(countryCode);

      if (!states || states.length === 0) {
        return res.status(404).json({ message: 'States not found' });
      }

      return res.json({ data: states.map(item => toLowerCamelCase(item))});
    } catch (err) {
      console.error('Error fetching states:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/statesByCountryId:
 *   get:
 *     summary: Retrieve states by country ID
 *     description: Get all states within a country using the country's ID.
 *     tags: [4th]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: countryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the country to retrieve states for.
 *     responses:
 *       200:
 *         description: States retrieved successfully.
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
 *                       stateId:
 *                         type: integer
 *                         description: Unique identifier for the state.
 *                         example: 85682091
 *                       stateName:
 *                         type: string
 *                         description: Name of the state.
 *                         example: "Alberta"
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
 *                       type: 
 *                         type: string
 *                         description: The type of validation error (e.g., "field").
 *                         example: "field"
 *                       value: 
 *                         type: string
 *                         description: The value that caused the validation error.
 *                         example: "-5"
 *                       msg:
 *                         type: string
 *                         description: The error message describing the validation failure.
 *                         example: "Country ID must be a positive integer"
 *                       path:
 *                         type: string
 *                         description: The field or parameter that failed validation.
 *                         example: "countryId"
 *                       location:
 *                         type: string
 *                         description: The location of the parameter (e.g., "query", "body", "params").
 *                         example: "query"
 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: States not found
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/statesByCountryId', apiRequestLimiter,
  [
    query('countryId')
      .exists().withMessage('Country ID is required')
      .isInt({ min: 1 }).withMessage('Country ID must be a positive integer')
      .toInt(),
  ],
  checkRequestValidity,
  (req, res, next) => {    
    const middleware = authorizeUser({ dom: '0', obj: 'mrag_addresses', act: 'R', attrs: {} });
    middleware(req, res, next);
  },
  async (req, res) => {
    const countryId = req.query.countryId;

    try {
      const states = await db.getStatesByCountryId(countryId);

      if (!states || states.length === 0) {
        return res.status(404).json({ message: 'States not found' });
      }

      return res.json({ data: states.map(item => toLowerCamelCase(item))});
    } catch (err) {
      console.error('Error fetching states:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /v1/citiesByState:
 *   get:
 *     summary: Retrieve cities by state ID and country ID
 *     description: Get all cities within a state using the state's ID and the country's ID.
 *     tags: [4th]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: countryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the country to retrieve cities for.
 *       - in: query
 *         name: stateId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the state to retrieve cities for.
 *     responses:
 *       200:
 *         description: States retrieved successfully.
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
 *                       stateId:
 *                         type: integer
 *                         description: Unique identifier for the city.
 *                         example: 890458845
 *                       stateName:
 *                         type: string
 *                         description: Name of the city.
 *                         example: "Calgary"
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
 *                       type: 
 *                         type: string
 *                         description: The type of validation error (e.g., "field").
 *                         example: "field"
 *                       value: 
 *                         type: string
 *                         description: The value that caused the validation error.
 *                         example: "-5"
 *                       msg:
 *                         type: string
 *                         description: The error message describing the validation failure.
 *                         example: "Country ID must be a positive integer"
 *                       path:
 *                         type: string
 *                         description: The field or parameter that failed validation.
 *                         example: "countryId"
 *                       location:
 *                         type: string
 *                         description: The location of the parameter (e.g., "query", "body", "params").
 *                         example: "query"
 *       404:
 *         description: Not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example:  Cities not found
 *       429:
 *         $ref: '#/components/responses/ApiRateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/ServerInternalError'
 */
router.get('/citiesByState', apiRequestLimiter,
  [
    query('countryId')
      .exists().withMessage('Country ID is required')
      .isInt({ min: 1 }).withMessage('Country ID must be a positive integer')
      .toInt(),

    query('stateId')
      .exists().withMessage('State ID is required')
      .isInt({ min: 1 }).withMessage('State ID must be a positive integer')
      .toInt(),
  ],
  checkRequestValidity,
  (req, res, next) => {    
    const middleware = authorizeUser({ dom: '0', obj: 'mrag_addresses', act: 'R', attrs: {} });
    middleware(req, res, next);
  },
  async (req, res) => {
    const countryId = req.query.countryId;
    const stateId = req.query.stateId;

    try {
      const cities = await db.getCitiesByState(countryId, stateId);

      if (!cities || cities.length === 0) {
        return res.status(404).json({ message: 'Cities not found' });
      }

      return res.json({data: cities.map(item => toLowerCamelCase(item))});
    } catch (err) {
      console.error('Error fetching cities:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);
