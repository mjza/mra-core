const gn = require('../../utils/generators');

describe('Generator Functions', () => {

    describe('generateRandomString', () => {
        it('should return a string of default length 8', () => {
            const result = gn.generateRandomString();

            expect(typeof result).toBe('string');
            expect(result).toHaveLength(8);
        });

        it('should return a string of specified length', () => {
            const length = 10;
            const result = gn.generateRandomString(length);

            expect(typeof result).toBe('string');
            expect(result).toHaveLength(length);
        });
    });
    
    describe('generateMockUserRoute', () => {
        it('should generate a user object with loginRedirectURL', () => {
            const user = gn.generateMockUserRoute();

            // Check that all properties exist
            expect(user).toHaveProperty('username');
            expect(user).toHaveProperty('email');
            expect(user).toHaveProperty('password', 'Pasword1$');
            expect(user).toHaveProperty('loginRedirectURL', 'http://localhost:3000/login');

            // Check that the email includes the username
            expect(user.email).toBe(user.email);
        });
    });

});
