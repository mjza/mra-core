const express = require('express');
const { query } = require('express-validator');
const db = require('../../utils/database');
const { checkRequestValidity } = require('../../utils/validations');
const { apiRequestLimiter } = require('../../utils/rateLimit');
const { toLowerCamelCase } = require('../../utils/converters');

const router = express.Router();

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

      return res.json({ data: addressDataArray.map(item => toLowerCamelCase(item)) });
    } catch (err) {
      console.error('Error fetching address data:', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
