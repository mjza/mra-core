import { generateMockUserRoute, generateRandomString } from '../../../utils/generators.mjs';

describe('Generator Functions', () => {

    describe('generateRandomString', () => {
        it('should return a string of default length 8', () => {
            const result = generateRandomString();

            expect(typeof result).toBe('string');
            expect(result).toHaveLength(8);
        });

        it('should return a string of specified length', () => {
            const length = 10;
            const result = generateRandomString(length);

            expect(typeof result).toBe('string');
            expect(result).toHaveLength(length);
        });
    });
    
    describe('generateMockUserRoute', () => {
        it('should generate a user object with loginRedirectURL', () => {
            const user = generateMockUserRoute();

            // Check that all properties exist
            expect(user).toHaveProperty('username');
            expect(user).toHaveProperty('email');
            expect(user).toHaveProperty('password', 'Password1$');
            expect(user).toHaveProperty('loginRedirectURL', 'http://example.com/');

            // Check that the email includes the username
            expect(user.email).toBe(user.email);
        });
    });

});
