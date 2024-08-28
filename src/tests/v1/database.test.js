const { Sequelize } = require('sequelize');
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

    describe('Audit Log DB functions', () => {
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

});
