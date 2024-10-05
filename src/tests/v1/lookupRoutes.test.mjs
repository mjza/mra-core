import axios from 'axios';
import request from 'supertest';
import { getUserByUserId } from '../../utils/database.mjs';
import { generateMockUserRoute } from '../../utils/generators.mjs';

describe('Test lookup endpoints', () => {

    const app = global.__APP__;

    let mockUser, authData;

    const headers = {
        'x-development-token': process.env.X_DEVELOPMENT_TOKEN,
    };

    beforeAll(async () => {

        mockUser = await generateMockUserRoute();
        let response = await axios.post(`${process.env.AUTH_SERVER_URL}/v1/register`, mockUser, { headers });
        const userId = response.data.userId;
        // Get the test user from the database
        const testUser = await getUserByUserId(userId);
        const inactiveUser = { username: testUser.username, activationCode: testUser.activation_code };
        await axios.post(`${process.env.AUTH_SERVER_URL}/v1/activate-by-code`, inactiveUser, { headers });
        const user = { usernameOrEmail: mockUser.username, password: mockUser.password };
        response = await axios.post(`${process.env.AUTH_SERVER_URL}/v1/login`, user, { headers });

        authData = response.data;
    });

    afterAll(async () => {
        try {
            headers['Authorization'] = `Bearer ${authData.token}`;
            await axios.delete(`${process.env.AUTH_SERVER_URL}/v1/deregister`, { headers });
        } catch (error) {
            console.error('Error during deregister:', error);
        }
    });

    // Test cases for /v1/gender_types
    describe('Test GET /v1/gender_types', () => {

        it('should return 403 when accessing without authentication', async () => {
            const res = await request(app).get('/v1/gender_types').set(headers);
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return gender types with authentication', async () => {
            const res = await request(app)
                .get('/v1/gender_types')
                .set(headers)
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.hasMore).toBeDefined();
        });
    });

    // Test cases for /v1/ticket_categories
    describe('GET /v1/ticket_categories', () => {

        it('should return 403 when accessing without authentication', async () => {
            const res = await request(app).get('/v1/ticket_categories').set(headers);
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return ticket categories with authentication', async () => {
            const res = await request(app)
                .get('/v1/ticket_categories')
                .set(headers)
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.hasMore).toBeDefined();
        });
    });
});
