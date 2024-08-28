const axios = require('axios');
const request = require('supertest');
const { createApp, closeApp } = require('../../app');
const db = require('../../utils/database');
const { generateMockUserRoute } = require('../../utils/generators');

describe('Test lookup endpoints', () => {
    let app, mockUser, authData;

    const headers = {
        headers: {
            'x-development-token': process.env.X_DEVELOPMENT_TOKEN,
        },
    };

    beforeAll(async () => {
        app = await createApp();

        mockUser = await generateMockUserRoute();
        let response = await axios.post(`${process.env.AUTH_SERVER_URL}/v1/register`, mockUser, headers);
        const userId = response.data.userId;
        // Get the test user from the database
        testUser = await db.getUserByUserId(userId);
        const inactiveUser = { username: testUser.username, activationCode: testUser.activation_code };
        await axios.post(`${process.env.AUTH_SERVER_URL}/v1/activate-by-code`, inactiveUser, headers);
        const user = { usernameOrEmail: mockUser.username, password: mockUser.password };
        response = await axios.post(`${process.env.AUTH_SERVER_URL}/v1/login`, user, headers);

        authData = response.data;
    });

    afterAll(async () => {
        await db.deleteUserByUsername(mockUser.username);
        await closeApp();
    });

    // Test cases for /v1/gender_types
    describe('Test GET /v1/gender_types', () => {

        it('should return 403 when accessing without authentication', async () => {
            const res = await request(app).get('/v1/gender_types');
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return gender types with authentication', async () => {
            const res = await request(app)
                .get('/v1/gender_types')
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.hasMore).toBeDefined();
        });
    });

    // Test cases for /v1/ticket_categories
    describe('GET /v1/ticket_categories', () => {

        it('should return 403 when accessing without authentication', async () => {
            const res = await request(app).get('/v1/ticket_categories');
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return ticket categories with authentication', async () => {
            const res = await request(app)
                .get('/v1/ticket_categories')
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.hasMore).toBeDefined();
        });
    });
});
