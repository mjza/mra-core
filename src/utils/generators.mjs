/**
 * Generates a random string of a specified length.
 * @param {number} [length=8] - The length of the string to generate. Default is 8 characters.
 * @returns {string} A random string of the specified length.
 */
export const generateRandomString = (length = 8) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
};

/**
 * Generates a mock user object for a user route.
 * This function creates a random username and uses it to construct an email.
 * It also sets a predefined password and a login redirect URL.
 *
 * @returns {Object} An object containing username, email, password, and loginRedirectURL.
 */
export const generateMockUserRoute = () => {
    var username = generateRandomString();
    return {
        username: username,
        email: 'info@example.com',
        password: 'Password1$',
        loginRedirectURL: 'http://example.com/'
    }
};
