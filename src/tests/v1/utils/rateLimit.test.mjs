import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { LanguageDetector, handle } from 'i18next-http-middleware';
import { join } from 'path';
import express from 'express';
import request from 'supertest';
import { apiRequestLimiter } from '../../../utils/rateLimit.mjs';

describe('Rate Limiters', () => {
    let app;

    // Initialize i18next with middleware
    beforeAll(async () => {
        await i18next
            .use(Backend)
            .use(LanguageDetector) // Add language detection
            .init({
                fallbackLng: 'en',
                preload: ['en'],
                backend: {
                    loadPath: join(process.cwd(), '/src/locales/{{lng}}.json'),
                },
            });

        app = express();
        app.use(express.json()); // Middleware to parse JSON bodies
        app.use(handle(i18next)); // Add i18next middleware to Express app
    });

    describe('apiRequestLimiter', () => {
        beforeEach(() => {
            app.use('/api', apiRequestLimiter); // Apply rate limiter to the /api route
            app.get('/api', (_, res) => res.status(200).json({ message: 'API Request Success' }));
        });

        test('should allow 60 requests in 1 minute window', async () => {
            for (let i = 0; i < 60; i++) {
                const response = await request(app).get('/api');
                expect(response.status).toBe(200);
            }
        });

        test('should block requests after exceeding limit', async () => {
            for (let i = 0; i < 60; i++) {
                await request(app).get('/api');
            }
            const response = await request(app).get('/api');
            expect(response.status).toBe(429);
            expect(response.body.message).toBe('Too many requests from this IP, please try again after 1 minutes.');
        });

        test('should skip rate limit with valid development token', async () => {
            process.env.X_DEVELOPMENT_TOKEN = 'valid-token'; // Set valid token
            const response = await request(app)
                .get('/api')
                .set('x-development-token', 'valid-token');
            expect(response.status).toBe(200);
        });
    });
});
