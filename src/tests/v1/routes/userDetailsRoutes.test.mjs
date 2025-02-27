import axios from 'axios';
import http from 'http';
import https from 'https';
import request from 'supertest';
import { getUserByUserId } from '../../../utils/database.mjs';
import { generateMockUserRoute } from '../../../utils/generators.mjs';

describe('/user_details endpoints', () => {

    const app = global.__APP__;

    let mockUser, createdUser, authData, userDetails;

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
        createdUser = await getUserByUserId(userId);
        const inactiveUser = { username: createdUser.username, activationCode: createdUser.activation_code };
        await axiosInstance.post(`${process.env.AUTH_SERVER_URL}/v1/activate-by-code`, inactiveUser, { headers });
        const user = { usernameOrEmail: mockUser.username, password: mockUser.password };
        response = await axiosInstance.post(`${process.env.AUTH_SERVER_URL}/v1/login`, user, { headers });

        authData = response.data;

        userDetails = {
            userId: createdUser.user_id,
            firstName: 'string1',
            middleName: 'string2',
            lastName: 'string3',
            displayName: mockUser.username,
            email: createdUser.email,
            genderId: 1,
            dateOfBirth: '2023-12-07',
            profilePictureUrl: 'http://example.com/123',
            isPrivatePicture: false
        };
    });

    // Ensure the app resources are closed after all tests
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

    describe('GET /user_details before creation', () => {
        it('should return a user details with no creator as it has not yet defined', async () => {
            const res = await request(app).get('/v1/user_details').set(headers)
                .set('Authorization', `Bearer ${authData.token}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body).not.toBeNull();
            expect(Array.isArray(res.body.data)).toBeTruthy();
            expect(res.body.data.length).toBe(1);
            expect(res.body.hasMore).toBeFalsy();
            const item = res.body.data[0];
            expect(item.userId).toBe(userDetails.userId);
            expect(item.email).toBe(userDetails.email);
            expect(item.displayName).toBe(userDetails.displayName);
            expect(item.firstName).toBeNull();
            expect(item.middleName).toBeNull();
            expect(item.lastName).toBeNull();
            expect(item.genderId).toBeNull();
            expect(item.gender).toBeNull();
            expect(item.dateOfBirth).toBeNull();
            expect(item.profilePictureUrl).toBeNull();
            expect(item.isPrivatePicture).toBeNull();
            expect(item.creator).toBeNull();
            expect(item.createdAt).toBeNull();
            expect(item.updator).toBeNull();
            expect(item.updatedAt).toBeNull();
        });
    });

    describe('PUT /user_details/:userId before creation', () => {
        it('should return 206 as user details has not yet defined', async () => {
            const res = await request(app).put(`/v1/user_details/${userDetails.userId}`).set(headers).send(userDetails)
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(206);
            expect(res.body).not.toBeNull();
            const item = res.body;
            expect(item.userId).toBe(userDetails.userId);
            expect(item.email).toBe(userDetails.email);
            expect(item.displayName).toBe(userDetails.displayName);
            expect(item.firstName).toBeNull();
            expect(item.middleName).toBeNull();
            expect(item.lastName).toBeNull();
            expect(item.genderId).toBeNull();
            expect(item.gender).toBeNull();
            expect(item.dateOfBirth).toBeNull();
            expect(item.profilePictureUrl).toBe(userDetails.profilePictureUrl);
            expect(item.isPrivatePicture).toBeFalsy();
            expect(item.creator).toBeNull();
            expect(item.createdAt).toBeNull();
            expect(item.updator).toBeNull();
            expect(item.updatedAt).toBeNull();
        });
    });

    describe('POST /user_details', () => {

        it('should not create user details for other user', async () => {
            const copy = { ...userDetails };
            copy.userId = 2147483647;
            const res = await request(app)
                .post('/v1/user_details')
                .set(headers)
                .send(copy)
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should create user details', async () => {
            const res = await request(app)
                .post('/v1/user_details')
                .set(headers)
                .send(userDetails)
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(201);
            expect(res.body).not.toBeNull();
            expect(res.body.firstName).toBe(userDetails.firstName);
            expect(res.body.middleName).toBe(userDetails.middleName);
            expect(res.body.lastName).toBe(userDetails.lastName);
            expect(res.body.genderId).toBe(userDetails.genderId);
            expect(res.body.gender.genderName).toBe('Female');
            expect(res.body.dateOfBirth).toBe(userDetails.dateOfBirth);
            expect(res.body.profilePictureUrl).toBe(userDetails.profilePictureUrl);
            expect(res.body.isPrivatePicture).toBe(userDetails.isPrivatePicture);
            expect(res.body.creator).toBe(userDetails.userId);
            expect(res.body.createdAt).toBeDefined();
            expect(res.body.updator).toBeNull();
            expect(res.body.updatedAt).toBeNull();
        });

        it('should return 403 as token is missing', async () => {
            const res = await request(app)
                .post('/v1/user_details')
                .set(headers)
                .send(userDetails);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return 403 as token is invalid', async () => {
            const res = await request(app)
                .post('/v1/user_details')
                .set(headers)
                .send(userDetails)
                .set('Authorization', `Bearer ${authData.token}` + 'x');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should not create user details for other user', async () => {
            const copy = { ...userDetails };
            copy.userId++;
            const res = await request(app)
                .post('/v1/user_details')
                .set(headers)
                .send(copy)
                .set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should returns 422 as the entity exists', async () => {
            const res = await request(app)
                .post('/v1/user_details')
                .set(headers)
                .send(userDetails).set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual('A record exists for the current user in the user details table.');
        });
    });

    describe('GET /user_details after creation', () => {
        it('should return 200 as user details has been defined already', async () => {
            const res = await request(app).get('/v1/user_details').set(headers).set('Authorization', `Bearer ${authData.token}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body).not.toBeNull();
            expect(Array.isArray(res.body.data)).toBeTruthy();
            expect(res.body.data.length).toBe(1);
            expect(res.body.hasMore).toBeFalsy();
            const item = res.body.data[0];
            expect(item.firstName).toBe(userDetails.firstName);
            expect(item.middleName).toBe(userDetails.middleName);
            expect(item.lastName).toBe(userDetails.lastName);
            expect(item.genderId).toBe(userDetails.genderId);
            expect(item.gender.genderName).toBe('Female');
            expect(item.dateOfBirth).toBe(userDetails.dateOfBirth);
            expect(item.profilePictureUrl).toBe(userDetails.profilePictureUrl);
            expect(item.isPrivatePicture).toBe(userDetails.isPrivatePicture);
            expect(item.creator).toBe(userDetails.userId);
            expect(item.createdAt).toBeDefined();
            expect(item.updator).toBeNull();
            expect(item.updatedAt).toBeNull();
        });

        it('should return 403 as token is missing', async () => {
            const res = await request(app).get('/v1/user_details').set(headers)
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return 403 as token is invalid', async () => {
            const res = await request(app).get('/v1/user_details').set(headers).set('Authorization', `Bearer ${authData.token}` + 'x');
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });
    });

    describe('PUT /user_details/:userId after creation', () => {
        it('should update user details', async () => {
            userDetails.firstName += 'x';
            userDetails.middleName += 'x';
            userDetails.lastName += 'x';
            userDetails.genderId = 2;
            userDetails.dateOfBirth = '2023-12-08';
            userDetails.profilePictureUrl += 'x';
            userDetails.isPrivatePicture = !userDetails.isPrivatePicture;

            const res = await request(app).put(`/v1/user_details/${userDetails.userId}`).set(headers).send(userDetails).set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).not.toBeNull();
            expect(res.body.firstName).toBe(userDetails.firstName);
            expect(res.body.middleName).toBe(userDetails.middleName);
            expect(res.body.lastName).toBe(userDetails.lastName);
            expect(res.body.genderId).toBe(userDetails.genderId);
            expect(res.body.gender.genderName).toBe('Male');
            expect(res.body.dateOfBirth).toBe(userDetails.dateOfBirth);
            expect(res.body.profilePictureUrl).toBe(userDetails.profilePictureUrl);
            expect(res.body.isPrivatePicture).toBe(userDetails.isPrivatePicture);
            expect(res.body.creator).toBe(userDetails.userId);
            expect(res.body.createdAt).toBeDefined();
            expect(res.body.updator).toBe(userDetails.userId);
            expect(res.body.updatedAt).toBeDefined();
        });

        it('should return 403 as token is missing', async () => {
            const res = await request(app).put(`/v1/user_details/${userDetails.userId}`).set(headers).send(userDetails);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should return 403 as token is invalid', async () => {
            const res = await request(app).put(`/v1/user_details/${userDetails.userId}`).set(headers).send(userDetails).set('Authorization', `Bearer ${authData.token}` + 'x');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should not update user details for other user', async () => {
            const res = await request(app).put(`/v1/user_details/${userDetails.userId + 1}`).set(headers).send(userDetails).set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('User is not authorized.');
        });

        it('should returns 400 as the gender id is wrong', async () => {
            const copy = { ...userDetails };
            copy.genderId = 2147483647;
            const res = await request(app).put(`/v1/user_details/${userDetails.userId}`).set(headers).send(copy).set('Authorization', `Bearer ${authData.token}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.errors[0].msg).toEqual('GenderId must be an integer between 0 and 9, inclusive.');
        });


        it('should return 429 after some attempts', async () => {
            var res;

            for (let i = 0; i < 61; i++) {
                res = await request(app).put('/v1/user_details/1');
            }

            expect(res.statusCode).toBe(429);
            expect(res.body.message).toBeDefined();
            expect(res.body.message).toBe('Too many requests from this IP, please try again after 1 minutes.');
            expect(res.headers).toHaveProperty('retry-after');
            expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);

            res = await request(app).post('/v1/user_details');

            expect(res.statusCode).toBe(429);
            expect(res.body.message).toBeDefined();
            expect(res.body.message).toBe('Too many requests from this IP, please try again after 1 minutes.');
            expect(res.headers).toHaveProperty('retry-after');
            expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);

            res = await request(app).get('/v1/user_details');

            expect(res.statusCode).toBe(429);
            expect(res.body.message).toBeDefined();
            expect(res.body.message).toBe('Too many requests from this IP, please try again after 1 minutes.');
            expect(res.headers).toHaveProperty('retry-after');
            expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);
        });
    });
});
