const express = require('express');
const { query } = require('express-validator');
const db = require('../../utils/database');
const { checkRequestValidity } = require('../../utils/validations');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { toLowerCamelCase } = require('../../utils/converters');

const router = express.Router();
module.exports = router;

/**
 * @swagger
 * /v1/countries:
 *   get:
 *     summary: Retrieve a list of countries
 *     description: Get a paginated list of countries with optional filters.
 *     tags: [4th]
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of countries to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of countries to skip before starting to collect the result set.
 *     responses:
 *       200:
 *         description: A list of countries retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   country_id:
 *                     type: integer
 *                     description: Unique identifier for the country.
 *                   country_name:
 *                     type: string
 *                     description: Name of the country.
 *                   iso_code:
 *                     type: string
 *                     description: ISO 3166-1 alpha-2 country code.
 *                   iso_long_code:
 *                     type: string
 *                     description: ISO 3166-1 alpha-3 country code.
 *                   dial_code:
 *                     type: string
 *                     description: Dial code for the country, including the plus sign.
 *                   languages:
 *                     type: string
 *                     description: Languages spoken in the country.
 *                   is_supported:
 *                     type: boolean
 *                     description: Whether the country is supported.
 *       400:
 *         description: Invalid request parameters.
 *       500:
 *         description: Server internal error.
 */
router.get('/countries', apiRequestLimiter,
  [
    query('isoCode')
      .optional()
      .isString().withMessage('ISO code must be a string')
      .trim(),

    query('countryName')
      .optional()
      .isString().withMessage('Country name must be a string')
      .trim(),

    query('isSupported')
      .optional()
      .isBoolean().withMessage('isSupported must be a boolean')
      .toBoolean(),

    query('limit')
      .optional()
      .isInt({ min: 1 }).withMessage('Limit must be a positive integer')
      .toInt()
      .default(10),

    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
      .toInt()
      .default(0),
  ],
  checkRequestValidity,
  async (req, res) => {
    
    const { isoCode, countryName, isSupported, limit, offset } = req.query;
    const where = {};
    if (isoCode) where.iso_code = isoCode;
    if (countryName) where.country_name = { ['Sequelize.Op.iLike']: `%${countryName}%` };
    if (isSupported !== undefined) where.is_supported = isSupported;

    const pagination = { limit, offset };

    try {
      const countries = await db.getCountries(where, pagination);

      if (!countries || countries.length === 0) {
        return res.status(404).json({ message: 'No countries found' });
      }

      return res.json({data: countries});
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
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Unique identifier for the address.
 *                   geoLatitude:
 *                     type: number
 *                     description: Latitude of the address.
 *                   geoLongitude:
 *                     type: number
 *                     description: Longitude of the address.
 *                   geoLocation:
 *                     type: object
 *                     description: Geo location object.
 *                   streetName:
 *                     type: string
 *                     description: Name of the street.
 *                   streetType:
 *                     type: string
 *                     description: Type of the street.
 *                   streetQuad:
 *                     type: string
 *                     description: Street quadrant.
 *                   streetFullName:
 *                     type: string
 *                     description: Full name of the street.
 *                   streetNo:
 *                     type: string
 *                     description: Street number.
 *                   houseNumber:
 *                     type: integer
 *                     description: House number.
 *                   houseAlpha:
 *                     type: string
 *                     description: House alpha.
 *                   unit:
 *                     type: string
 *                     description: Unit number.
 *                   city:
 *                     type: string
 *                     description: City name.
 *                   region:
 *                     type: string
 *                     description: Region name.
 *                   postalCode:
 *                     type: string
 *                     description: Postal code.
 *                   fullAddress:
 *                     type: string
 *                     description: Full address.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: Address data not found.
 *       429:
 *         description: API rate limit exceeded.
 *       500:
 *         description: Server internal error.
 */
router.get('/addresses', apiRequestLimiter,
  [
    query('longitude')
      .exists().withMessage('Longitude is required')
      .isFloat().withMessage('Longitude must be a number')
      .toFloat(),

    query('latitude')
      .exists().withMessage('Latitude is required')
      .isFloat().withMessage('Latitude must be a number')
      .toFloat(),
  ],
  checkRequestValidity,
  async (req, res) => {
    const longitude = req.query.longitude;
    const latitude = req.query.latitude;

    try {
      const addressDataArray = await db.getAddressData(longitude, latitude);

      if (!addressDataArray || addressDataArray.length === 0) {
        return res.status(404).json({ message: 'Address data not found' });
      }

      return res.json(addressDataArray.map(item => toLowerCamelCase(item)));
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
 *                 countryId:
 *                   type: integer
 *                   description: Unique identifier for the country.
 *                 countryCode:
 *                   type: string
 *                   description: ISO code of the country.
 *                 stateId:
 *                   type: integer
 *                   description: Unique identifier for the state.
 *                 state:
 *                   type: string
 *                   description: Name of the state.
 *                 cityId:
 *                   type: integer
 *                   description: Unique identifier for the city.
 *                 city:
 *                   type: string
 *                   description: Name of the city.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: Location data not found.
 *       429:
 *         description: API rate limit exceeded.
 *       500:
 *         description: Server internal error.
 */
router.get('/location', apiRequestLimiter,
  [
    query('longitude')
      .exists().withMessage('Longitude is required')
      .isFloat().withMessage('Longitude must be a number')
      .toFloat(),

    query('latitude')
      .exists().withMessage('Latitude is required')
      .isFloat().withMessage('Latitude must be a number')
      .toFloat(),
  ],
  checkRequestValidity,
  async (req, res) => {
    const longitude = req.query.longitude;
    const latitude = req.query.latitude;

    try {
      const locationData = await db.getLocationData(longitude, latitude);

      if (!locationData) {
        return res.status(404).json({ message: 'Location data not found' });
      }

      return res.json(toLowerCamelCase(locationData));
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
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   stateId:
 *                     type: integer
 *                     description: Unique identifier for the state.
 *                   stateName:
 *                     type: string
 *                     description: Name of the state.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: States not found.
 *       429:
 *         description: API rate limit exceeded.
 *       500:
 *         description: Server internal error.
 */
router.get('/statesByCountryCode', apiRequestLimiter,
  [
    query('countryCode')
      .exists().withMessage('Country code is required')
      .isString().withMessage('Country code must be a string')
      .trim()
      .toUpperCase(),
  ],
  checkRequestValidity,
  async (req, res) => {
    const countryCode = req.query.countryCode;

    try {
      const states = await db.getStatesByCountryCode(countryCode);

      if (!states || states.length === 0) {
        return res.status(404).json({ message: 'States not found' });
      }

      return res.json(states.map(item => toLowerCamelCase(item)));
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
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   stateId:
 *                     type: integer
 *                     description: Unique identifier for the state.
 *                   stateName:
 *                     type: string
 *                     description: Name of the state.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: States not found.
 *       429:
 *         description: API rate limit exceeded.
 *       500:
 *         description: Server internal error.
 */
router.get('/statesByCountryId', apiRequestLimiter,
  [
    query('countryId')
      .exists().withMessage('Country ID is required')
      .isInt({ min: 1 }).withMessage('Country ID must be a positive integer')
      .toInt(),
  ],
  checkRequestValidity,
  async (req, res) => {
    const countryId = req.query.countryId;

    try {
      const states = await db.getStatesByCountryId(countryId);

      if (!states || states.length === 0) {
        return res.status(404).json({ message: 'States not found' });
      }

      return res.json(states.map(item => toLowerCamelCase(item)));
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
 *         description: Cities retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   cityId:
 *                     type: integer
 *                     description: Unique identifier for the city.
 *                   cityName:
 *                     type: string
 *                     description: Name of the city.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: Cities not found.
 *       429:
 *         description: API rate limit exceeded.
 *       500:
 *         description: Server internal error.
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
  async (req, res) => {
    const countryId = req.query.countryId;
    const stateId = req.query.stateId;

    try {
      const cities = await db.getCitiesByState(countryId, stateId);

      if (!cities || cities.length === 0) {
        return res.status(404).json({ message: 'Cities not found' });
      }

      return res.json(cities.map(item => toLowerCamelCase(item)));
    } catch (err) {
      console.error('Error fetching cities:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);
