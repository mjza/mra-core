const { Sequelize, Op } = require('sequelize');
const db = require('../../utils/database');
const axios = require('axios');
const { generateMockUserRoute } = require('../../utils/generators');

describe('Test DB functions', () => {

    let mockUser;

    const headers = {
        headers: {
            'x-development-token': process.env.X_DEVELOPMENT_TOKEN,
        },
    };

    beforeAll(async () => {
        mockUser = await generateMockUserRoute();
        let response = await axios.post(`${process.env.AUTH_SERVER_URL}/v1/register`, mockUser, headers);
        const userId = response.data.userId;
        // Get the test user from the database
        testUser = await db.getUserByUserId(userId);
        var inactiveUser = { username: testUser.username, activationCode: testUser.activation_code };
        await axios.post(`${process.env.AUTH_SERVER_URL}/v1/activate-by-code`, inactiveUser, headers);
    });

    afterAll(async () => {
        await db.deleteUserByUsername(mockUser.username);
        await db.closeDBConnections();
    });

    describe('Test addDateRangeFilter', () => {

        let where;

        beforeEach(() => {
            // Reset the where clause object before each test
            where = {};
        });

        it('should add a "greater than or equal to" filter when only the "After" field is present', () => {
            const query = {
                createdAtAfter: '2024-08-01'
            };

            db.addDateRangeFilter(where, query, 'createdAt');

            expect(where).toHaveProperty('createdAt');
            expect(where.createdAt[Sequelize.Op.gte]).toEqual(new Date('2024-08-01'));
            expect(where.createdAt[Sequelize.Op.lte]).toBeUndefined();
        });

        it('should add a "less than or equal to" filter when only the "Before" field is present', () => {
            const query = {
                createdAtBefore: '2024-08-10'
            };

            db.addDateRangeFilter(where, query, 'createdAt');

            expect(where).toHaveProperty('createdAt');
            expect(where.createdAt[Sequelize.Op.lte]).toEqual(new Date('2024-08-10'));
            expect(where.createdAt[Sequelize.Op.gte]).toBeUndefined();
        });

        it('should add both "greater than or equal to" and "less than or equal to" filters when both fields are present', () => {
            const query = {
                createdAtAfter: '2024-08-01',
                createdAtBefore: '2024-08-10'
            };

            db.addDateRangeFilter(where, query, 'createdAt');

            expect(where).toHaveProperty('createdAt');
            expect(where.createdAt[Sequelize.Op.gte]).toEqual(new Date('2024-08-01'));
            expect(where.createdAt[Sequelize.Op.lte]).toEqual(new Date('2024-08-10'));
        });

        it('should not modify the where clause if neither "After" nor "Before" fields are present', () => {
            const query = {
                someOtherField: 'someValue'
            };

            db.addDateRangeFilter(where, query, 'createdAt');

            expect(where).not.toHaveProperty('createdAt');
        });

        it('should handle non-date strings gracefully', () => {
            const query = {
                createdAtAfter: 'not-a-date',
                createdAtBefore: 'still-not-a-date'
            };

            db.addDateRangeFilter(where, query, 'createdAt');

            expect(where).toHaveProperty('createdAt');
            // Check that the createdAt[Sequelize.Op.gte] is an invalid date
            expect(isNaN(where.createdAt[Sequelize.Op.gte].getTime())).toBe(true);
            // Check that the createdAt[Sequelize.Op.lte] is an invalid date
            expect(isNaN(where.createdAt[Sequelize.Op.lte].getTime())).toBe(true);
        });

        it('should not overwrite existing conditions on the same field', () => {
            where = {
                createdAt: {
                    [Sequelize.Op.eq]: new Date('2024-08-05')
                }
            };

            const query = {
                createdAtAfter: '2024-08-01',
                createdAtBefore: '2024-08-10'
            };

            db.addDateRangeFilter(where, query, 'createdAt');

            expect(where).toHaveProperty('createdAt');
            expect(where.createdAt[Sequelize.Op.eq]).toEqual(new Date('2024-08-05'));
            expect(where.createdAt[Sequelize.Op.gte]).toEqual(new Date('2024-08-01'));
            expect(where.createdAt[Sequelize.Op.lte]).toEqual(new Date('2024-08-10'));
        });
    });

    describe('Test convertSequelizeOperators', () => {

        it('should convert a single operator in a simple object', () => {
            const input = {
                'Sequelize.Op.eq': 'testValue'
            };

            const expectedOutput = {
                [Op.eq]: 'testValue'
            };

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(expectedOutput);
        });

        it('should convert multiple operators in a simple object', () => {
            const input = {
                'Sequelize.Op.gt': 5,
                'Sequelize.Op.lt': 10
            };

            const expectedOutput = {
                [Op.gt]: 5,
                [Op.lt]: 10
            };

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(expectedOutput);
        });

        it('should convert operators in a nested object', () => {
            const input = {
                nestedField: {
                    'Sequelize.Op.and': [
                        { 'Sequelize.Op.gt': 5 },
                        { 'Sequelize.Op.lt': 10 }
                    ]
                }
            };

            const expectedOutput = {
                nestedField: {
                    [Op.and]: [
                        { [Op.gt]: 5 },
                        { [Op.lt]: 10 }
                    ]
                }
            };

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(expectedOutput);
        });

        it('should handle arrays containing objects with operators', () => {
            const input = [
                { 'Sequelize.Op.eq': 'value1' },
                { 'Sequelize.Op.ne': 'value2' }
            ];

            const expectedOutput = [
                { [Op.eq]: 'value1' },
                { [Op.ne]: 'value2' }
            ];

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(expectedOutput);
        });

        it('should leave non-operator keys unchanged', () => {
            const input = {
                regularKey: 'regularValue',
                'Sequelize.Op.or': [{ key1: 'value1' }, { key2: 'value2' }]
            };

            const expectedOutput = {
                regularKey: 'regularValue',
                [Op.or]: [{ key1: 'value1' }, { key2: 'value2' }]
            };

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(expectedOutput);
        });

        it('should handle a deeply nested structure with mixed operators and regular keys', () => {
            const input = {
                level1: {
                    level2: {
                        'Sequelize.Op.and': [
                            { 'Sequelize.Op.eq': 'value1' },
                            { regularKey: 'regularValue' }
                        ]
                    },
                    anotherKey: {
                        'Sequelize.Op.gt': 100
                    }
                }
            };

            const expectedOutput = {
                level1: {
                    level2: {
                        [Op.and]: [
                            { [Op.eq]: 'value1' },
                            { regularKey: 'regularValue' }
                        ]
                    },
                    anotherKey: {
                        [Op.gt]: 100
                    }
                }
            };

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(expectedOutput);
        });

        it('should return the input unchanged if no operators are present', () => {
            const input = {
                key1: 'value1',
                key2: 'value2'
            };

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(input);
        });

        it('should return the input unchanged if the input is not an object', () => {
            const input = 'Not an object';

            const result = db.convertSequelizeOperators(input);

            expect(result).toEqual(input);
        });

        it('should return the input unchanged if the input is null', () => {
            const input = null;

            const result = db.convertSequelizeOperators(input);

            expect(result).toBeNull();
        });

    });

    describe('Test auditLog functions', () => {
        let mockLog;
        let insertedLog;
        let updatedLog;

        beforeAll(() => {
            mockLog = {
                methodRoute: 'TEST : /testRoute',
                req: { param: 'test' },
                comments: 'Initial comment',
                ipAddress: '127.0.0.1',
                userId: '123'
            };
        });

        afterAll(async () => {
            if (insertedLog) {
                await db.deleteAuditLog(insertedLog.log_id);
            }
        });

        describe('insertAuditLog', () => {
            it('should insert a new audit log', async () => {
                insertedLog = await db.insertAuditLog(mockLog);

                expect(insertedLog).toBeDefined();
                expect(insertedLog.method_route).toBe(mockLog.methodRoute);
                expect(insertedLog.req).toStrictEqual(mockLog.req);
                expect(insertedLog.comments).toBe(mockLog.comments);
                expect(insertedLog.ip_address).toBe(mockLog.ipAddress);
                expect(insertedLog.user_id).toBe(mockLog.userId);
            });
        });

        describe('updateAuditLog', () => {
            it('should update an existing audit log', async () => {
                const updateData = {
                    logId: insertedLog.log_id,
                    comments: 'Updated comment'
                };
                updatedLog = await db.updateAuditLog(updateData);

                expect(updatedLog).toBeDefined();
                // it must still keep the initial content
                expect(updatedLog.comments).toContain('Initial comment');
                // it must have the new content too
                expect(updatedLog.comments).toContain('Updated comment');
            });
        });
    });

    describe('Test getGenderTypes', () => {
        it('should return all gender types without any filter and pagination', async () => {
            const where = {}; // No filters
            const pagination = { limit: 100, offset: 0 }; // Large limit to get all results

            const result = await db.getGenderTypes(where, pagination);

            expect(result).toHaveLength(10);
            expect(result).toEqual([
                { gender_id: 1, gender_name: 'Female', sort_order: 1 },
                { gender_id: 2, gender_name: 'Male', sort_order: 2 },
                { gender_id: 3, gender_name: 'Agender', sort_order: 3 },
                { gender_id: 4, gender_name: 'Bigender', sort_order: 4 },
                { gender_id: 5, gender_name: 'Genderqueer', sort_order: 5 },
                { gender_id: 6, gender_name: 'Intersex', sort_order: 6 },
                { gender_id: 7, gender_name: 'Non-binary', sort_order: 7 },
                { gender_id: 8, gender_name: 'Transgender', sort_order: 8 },
                { gender_id: 9, gender_name: 'Two-spirit', sort_order: 9 },
                { gender_id: 0, gender_name: 'Prefer not to say', sort_order: 10 }
            ]);
        });

        it('should return a subset of gender types with pagination (limit 3, offset 0)', async () => {
            const where = {}; // No filters
            const pagination = { limit: 3, offset: 0 };

            const result = await db.getGenderTypes(where, pagination);

            expect(result).toHaveLength(3);
            expect(result).toEqual([
                { gender_id: 1, gender_name: 'Female', sort_order: 1 },
                { gender_id: 2, gender_name: 'Male', sort_order: 2 },
                { gender_id: 3, gender_name: 'Agender', sort_order: 3 }
            ]);
        });

        it('should return a subset of gender types with pagination (limit 3, offset 3)', async () => {
            const where = {}; // No filters
            const pagination = { limit: 3, offset: 3 };

            const result = await db.getGenderTypes(where, pagination);

            expect(result).toHaveLength(3);
            expect(result).toEqual([
                { gender_id: 4, gender_name: 'Bigender', sort_order: 4 },
                { gender_id: 5, gender_name: 'Genderqueer', sort_order: 5 },
                { gender_id: 6, gender_name: 'Intersex', sort_order: 6 }
            ]);
        });

        it('should return the last subset of gender types with pagination (limit 3, offset 6)', async () => {
            const where = {}; // No filters
            const pagination = { limit: 3, offset: 6 };

            const result = await db.getGenderTypes(where, pagination);

            expect(result).toHaveLength(3);
            expect(result).toEqual([
                { gender_id: 7, gender_name: 'Non-binary', sort_order: 7 },
                { gender_id: 8, gender_name: 'Transgender', sort_order: 8 },
                { gender_id: 9, gender_name: 'Two-spirit', sort_order: 9 }
            ]);
        });

        it('should return a single gender type based on filter', async () => {
            const where = { gender_name: 'Agender' };
            const pagination = { limit: 10, offset: 0 };

            const result = await db.getGenderTypes(where, pagination);

            expect(result).toHaveLength(1);
            expect(result).toEqual([
                { gender_id: 3, gender_name: 'Agender', sort_order: 3 }
            ]);
        });

        it('should return no gender types if the filter does not match', async () => {
            const where = { gender_name: 'Non-existent' };
            const pagination = { limit: 10, offset: 0 };

            const result = await db.getGenderTypes(where, pagination);

            expect(result).toHaveLength(0);
        });
    });

    describe('Test geo related functions', () => {

        describe('getCountries', () => {
            it('should retrieve all countries without any filters', async () => {
                const where = {}; // No filters
                const pagination = { limit: 100, offset: 0 };

                const result = await db.getCountries(where, pagination);

                // Check that multiple countries are returned
                expect(result.length).toBeGreaterThan(1);
                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            country_id: expect.any(Number),
                            country_name: expect.any(String),
                            iso_code: expect.any(String),
                            iso_long_code: expect.any(String),
                            dial_code: expect.any(String),
                            languages: expect.any(String),
                            is_supported: expect.any(Boolean),
                        }),
                    ])
                );
            });

            it('should apply the where filter correctly for iso_code "CA"', async () => {
                const where = { iso_code: 'CA' };
                const pagination = { limit: 10, offset: 0 };

                const result = await db.getCountries(where, pagination);

                expect(result).toHaveLength(1);
                expect(result[0]).toMatchObject({
                    country_id: expect.any(Number),
                    country_name: 'Canada',
                    iso_code: 'CA',
                    iso_long_code: 'CAN',
                    dial_code: '1',
                    languages: expect.any(String),
                    is_supported: true, // This flag should be true for Canada
                });
            });

            it('should return countries with is_supported set to true', async () => {
                const where = { is_supported: true };
                const pagination = { limit: 100, offset: 0 };

                const result = await db.getCountries(where, pagination);

                // Assuming Canada is the only supported country
                expect(result).toHaveLength(1);
                expect(result[0]).toMatchObject({
                    country_id: expect.any(Number),
                    country_name: 'Canada',
                    iso_code: 'CA',
                    iso_long_code: 'CAN',
                    dial_code: '1',
                    languages: expect.any(String),
                    is_supported: true,
                });
            });

            it('should return an empty array if the filter does not match any records', async () => {
                const where = { iso_code: 'XYZ' }; // Unsupported country code
                const pagination = { limit: 10, offset: 0 };

                const result = await db.getCountries(where, pagination);

                expect(result).toEqual([]); // Expecting no results for unsupported country code
            });

            it('should handle pagination correctly (limit 2, offset 0)', async () => {
                const where = {}; // No filters
                const pagination = { limit: 2, offset: 0 };

                const result = await db.getCountries(where, pagination);

                expect(result).toHaveLength(2);
                expect(result[0]).toMatchObject({
                    country_id: expect.any(Number),
                    country_name: expect.any(String),
                    iso_code: expect.any(String),
                    iso_long_code: expect.any(String),
                    dial_code: expect.any(String),
                    languages: expect.any(String),
                    is_supported: expect.any(Boolean),
                });
            });

            it('should return an empty array if offset is greater than the number of records', async () => {
                const where = {}; // No filters
                const pagination = { limit: 10, offset: 1000 }; // Offset greater than total records

                const result = await db.getCountries(where, pagination);

                expect(result).toEqual([]); // Expecting no results due to high offset
            });

            it('should throw an error if limit or offset are invalid', async () => {
                const invalidPaginationCases = [
                    { limit: 'invalid', offset: 0 },
                    { limit: 10, offset: 'invalid' },
                    { limit: 0, offset: 0 },
                    { limit: -1, offset: 0 },
                    { limit: 10, offset: -1 },
                ];

                for (const pagination of invalidPaginationCases) {
                    await expect(db.getCountries({}, pagination)).rejects.toThrow('Limit and offset must be valid numbers');
                }
            });
        });


        describe('getAddressData', () => {
            it('should retrieve address data for the given latitude and longitude', async () => {
                const latitude = 51.07462;
                const longitude = -114.12839;

                const result = await db.getAddressData(longitude, latitude);

                // Expecting an array of Address instances
                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(1);

                const address = result[0];

                expect(address).toMatchObject({
                    id: '734f535bebd6ae6709cc',
                    geo_latitude: '51.07462',
                    geo_longitude: '-114.12839',
                    street_name: 'UNIVERSITY',
                    street_type: 'DR',
                    street_quad: 'NW',
                    street_full_name: 'UNIVERSITY DR NW',
                    street_no: '2500',
                    house_number: 2500,
                    house_alpha: '',
                    unit: null,
                    city: 'Calgary',
                    region: 'Alberta',
                    postal_code: 'T2N 1N4',
                    full_address: '2500 UNIVERSITY DR NW',
                    country_code: 'CA',
                    country_name: 'Canada',
                });
            });

            it('should throw a SequelizeDatabaseError if the country found for the coordinates is not supported', async () => {
                const latitude = 0; // An unlikely latitude
                const longitude = 0; // An unlikely longitude

                await expect(db.getAddressData(longitude, latitude)).rejects.toThrow('Country found for the given coordinates, however, it is not supported');
            });

        });

        describe('getLocationData', () => {
            it('should retrieve location data for the given latitude and longitude', async () => {
                const latitude = 51.07462;
                const longitude = -114.12839;

                const result = await db.getLocationData(longitude, latitude);

                expect(result).toMatchObject({
                    country_id: expect.any(Number),
                    country_code: 'CA',
                    country_name: 'Canada',
                    state_id: expect.any(Number),
                    state: 'Alberta',
                    city_id: expect.any(Number),
                    city: 'Calgary',
                });
            });

            it('should throw an error if the country found for the coordinates is not supported', async () => {
                const latitude = 0; // An unlikely latitude
                const longitude = 0; // An unlikely longitude

                await expect(db.getLocationData(longitude, latitude)).rejects.toThrow(
                    'Country found for the given coordinates, however, it is not supported'
                );
            });

            it('should throw an error if the country coordinates are out of the range', async () => {
                const latitude = -360; // An unlikely latitude
                const longitude = 360; // An unlikely longitude

                await expect(db.getLocationData(longitude, latitude)).rejects.toThrow(
                    'Country not found for the given coordinates'
                );
            });

        });

        describe('getStatesByCountryCode', () => {
            it('should retrieve the correct states for country code "CA"', async () => {
                const countryCode = 'CA';

                const result = await db.getStatesByCountryCode(countryCode);

                expect(result).toEqual([
                    { state_id: 85682091, state_name: 'Alberta' },
                    { state_id: 85682065, state_name: 'New Brunswick' },
                    { state_id: 85682117, state_name: 'British Columbia' },
                    { state_id: 85682123, state_name: 'Newfoundland and Labrador' },
                    { state_id: 85682081, state_name: 'Prince Edward Island' },
                    { state_id: 85682085, state_name: 'Manitoba' },
                    { state_id: 85682067, state_name: 'Northwest Territories' },
                    { state_id: 85682075, state_name: 'Nova Scotia' },
                    { state_id: 85682105, state_name: 'Nunavut' },
                    { state_id: 136251273, state_name: 'Quebec' },
                    { state_id: 85682095, state_name: 'Yukon' },
                    { state_id: 85682057, state_name: 'Ontario' },
                    { state_id: 85682113, state_name: 'Saskatchewan' }
                ]);
            });

            it('should throw an error if the country not found', async () => {
                const countryCode = 'XYZ'; // An unlikely country code

                await expect(db.getStatesByCountryCode(countryCode)).rejects.toThrow(
                    'Country with ISO code XYZ not found.'
                );
            });

            it('should throw an error if the country found for the given country code is not supported', async () => {
                const countryCode = 'US'; // An unlikely country code

                await expect(db.getStatesByCountryCode(countryCode)).rejects.toThrow(
                    'Country with ISO code US is not supported.'
                );
            });
        });

        describe('getStatesByCountryId', () => {
            it('should retrieve the correct states for Canada', async () => {
                const countryId = 85633041;

                const result = await db.getStatesByCountryId(countryId);

                expect(result).toEqual([
                    { state_id: 85682091, state_name: 'Alberta' },
                    { state_id: 85682065, state_name: 'New Brunswick' },
                    { state_id: 85682117, state_name: 'British Columbia' },
                    { state_id: 85682123, state_name: 'Newfoundland and Labrador' },
                    { state_id: 85682081, state_name: 'Prince Edward Island' },
                    { state_id: 85682085, state_name: 'Manitoba' },
                    { state_id: 85682067, state_name: 'Northwest Territories' },
                    { state_id: 85682075, state_name: 'Nova Scotia' },
                    { state_id: 85682105, state_name: 'Nunavut' },
                    { state_id: 136251273, state_name: 'Quebec' },
                    { state_id: 85682095, state_name: 'Yukon' },
                    { state_id: 85682057, state_name: 'Ontario' },
                    { state_id: 85682113, state_name: 'Saskatchewan' }
                ]);
            });

            it('should throw an error if the country not found', async () => {
                const countryId = 1; // An unlikely country id

                await expect(db.getStatesByCountryId(countryId)).rejects.toThrow(
                    'Country with ID 1 not found.'
                );
            });

            it('should throw an error if the country found for the given id is not supported', async () => {
                const countryId = 85632361; // An unlikely country code

                await expect(db.getStatesByCountryId(countryId)).rejects.toThrow(
                    'Country with ID 85632361 is not supported.'
                );
            });
        });

        describe('getCitiesByState', () => {
            it('should retrieve the correct cities for country_id 85633041 and state_id 85682091', async () => {
                const countryId = 85633041;
                const stateId = 85682091;

                const result = await db.getCitiesByState(countryId, stateId);

                expect(result).toEqual(
                    expect.arrayContaining([
                        { city_id: expect.any(Number), city_name: expect.any(String) },
                    ])
                );
            });

            it('should throw an error if the country not found', async () => {
                const countryId = 1; // An unlikely country id
                const stateId = 85682091;

                await expect(db.getCitiesByState(countryId, stateId)).rejects.toThrow(
                    'Country with ID 1 not found.'
                );
            });

            it('should throw an error if the country found for the given id is not supported', async () => {
                const countryId = 85632361;
                const stateId = 1;

                await expect(db.getCitiesByState(countryId, stateId)).rejects.toThrow(
                    'Country with ID 85632361 is not supported.'
                );
            });

            it('should throw an error if the state not found', async () => {
                const invalidCountryId = 85633041; // Invalid country ID
                const invalidStateId = 1; // Invalid state ID

                await expect(db.getCitiesByState(invalidCountryId, invalidStateId)).rejects.toThrow('State with ID 1 not found in the country with ID 85633041.');
            });
        });


    });

});
