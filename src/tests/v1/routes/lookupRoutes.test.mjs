import axios from 'axios';
import http from 'http';
import https from 'https';
import request from 'supertest';
import { getUserByUserId } from '../../../utils/database.mjs';
import { generateMockUserRoute } from '../../../utils/generators.mjs';

describe('Test lookup endpoints', () => {

    const app = global.__APP__;

    let mockUser, authData;

    const headers = {
        'x-development-token': process.env.X_DEVELOPMENT_TOKEN,
    };

    const axiosInstance = axios.create({
        httpAgent: new http.Agent({ keepAlive: false }),
        httpsAgent: new https.Agent({ keepAlive: false }),
    });

    beforeAll(async () => {

        mockUser = await generateMockUserRoute();
        let response = await axiosInstance.post(`${process.env.AUTH_SERVER_URL}/v1/register`, mockUser, { headers });
        const userId = response.data.userId;
        // Get the test user from the database
        const testUser = await getUserByUserId(userId);
        const inactiveUser = { username: testUser.username, activationCode: testUser.activation_code };
        await axiosInstance.post(`${process.env.AUTH_SERVER_URL}/v1/activate-by-code`, inactiveUser, { headers });
        const user = { usernameOrEmail: mockUser.username, password: mockUser.password };
        response = await axiosInstance.post(`${process.env.AUTH_SERVER_URL}/v1/login`, user, { headers });

        authData = response.data;
    });

    afterAll(async () => {
        try {
            headers['Authorization'] = `Bearer ${authData.token}`;
            await axiosInstance.delete(`${process.env.AUTH_SERVER_URL}/v1/deregister`, { headers });
        } catch (error) {
            console.error('Error during deregister:', error);
        } finally {
            // Explicitly destroy the agents to close any open sockets
            if (axiosInstance.defaults.httpAgent) {
                axiosInstance.defaults.httpAgent.destroy();
            }
            if (axiosInstance.defaults.httpsAgent) {
                axiosInstance.defaults.httpsAgent.destroy();
            }
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
