// Keep thos lines above this import, otherwise the environment SECRET_KEY will be used.
// Tests are designed with this secret key to see the expected results.
import { convertRequestData, decrypt, decryptObjectItems, encrypt, encryptObjectItems, toLowerCamelCase, toSnakeCase } from '../../utils/converters.mjs';

describe('Test converters', () => {

    describe('toLowerCamelCase', () => {
        test('should convert keys from snake_case to lowerCamelCase', () => {
            const inputObj = {
                first_name: 'John',
                last_name: 'Doe',
                contact_info: {
                    email_address: 'john.doe@example.com',
                    phone_number: '1234567890'
                }
            };
            const expectedOutput = {
                firstName: 'John',
                lastName: 'Doe',
                contactInfo: {
                    emailAddress: 'john.doe@example.com',
                    phoneNumber: '1234567890'
                }
            };
            expect(toLowerCamelCase(inputObj)).toEqual(expectedOutput);
        });

        test('should handle date objects correctly', () => {
            const date = new Date();
            const inputObj = { created_at: date };
            expect(toLowerCamelCase(inputObj)).toEqual({ createdAt: date });
        });

        test('should handle arrays correctly', () => {
            const inputObj = { user_ids: [1, 2, 3] };
            expect(toLowerCamelCase(inputObj)).toEqual({ userIds: [1, 2, 3] });
        });
    });

    describe('toSnakeCase', () => {
        test('should convert keys from lowerCamelCase to snake_case', () => {
            const inputObj = {
                firstName: 'John',
                lastName: 'Doe',
                contactInfo: {
                    emailAddress: 'john.doe@example.com',
                    phoneNumber: '1234567890'
                }
            };
            const expectedOutput = {
                first_name: 'John',
                last_name: 'Doe',
                contact_info: {
                    email_address: 'john.doe@example.com',
                    phone_number: '1234567890'
                }
            };
            expect(toSnakeCase(inputObj)).toEqual(expectedOutput);
        });

        test('should handle date objects correctly', () => {
            const date = new Date();
            const inputObj = { createdAt: date };
            expect(toSnakeCase(inputObj)).toEqual({ created_at: date });
        });

        test('should handle arrays correctly', () => {
            const inputObj = { userIds: [1, 2, 3] };
            expect(toSnakeCase(inputObj)).toEqual({ user_ids: [1, 2, 3] });
        });
    });

    describe('convertRequestData', () => {
        test('should convert request data correctly', () => {
            const req = {
                method: 'GET',
                originalUrl: '/api/users/123',
                headers: {
                    'authorization': 'Bearer xyz123',
                    'content-type': 'application/json',
                    'x-development-token': 'abcd'
                },
                body: {
                    password: 'secret',
                    email: 'test@example.com',
                    dateOfBirth: new Date(),
                    profilePictureUrl: 'abc',
                    profilePictureThumbnailUrl: 'def'
                },
                query: {
                    token: 'abcdef',
                    page: 1
                },
                params: {
                    id: '123'
                },
                ip: '127.0.0.1',
                hostname: 'localhost',
                protocol: 'http',
                path: '/api/users/124',
                cookies: {
                    sessionId: 'abc123',
                    userId: '456',
                    firstName: 'Mahdi',
                    middleName: 'Jaberzadeh',
                    lastName: 'Ansari'
                }
            };

            const expectedOutput = {
                method: 'GET',
                url: '/api/users/123',
                headers: {
                    'authorization': '****',
                    'content-type': 'application/json',
                    'x-development-token': '****'
                },
                body: {
                    password: '****',
                    email: '****',
                    dateOfBirth: '****',
                    profilePictureUrl: '****',
                    profilePictureThumbnailUrl: '****'
                },
                query: {
                    token: '****',
                    page: 1
                },
                params: {
                    id: '123'
                },
                ip: '127.0.0.1',
                hostname: 'localhost',
                protocol: 'http',
                path: '/api/users/124',
                cookies: {
                    sessionId: 'abc123',
                    userId: '456',
                    firstName: '****',
                    middleName: '****',
                    lastName: '****'
                }
            };

            expect(convertRequestData(req)).toEqual(expectedOutput);
        });

        test('should handle circular references gracefully', () => {
            const obj = { a: 1 };
            obj.b = obj;
            const req = { body: obj };

            const result = convertRequestData(req);

            expect(result.body).toEqual(obj);
        });

        test('should handle non-object values', () => {
            const req = {
                method: 'GET',
                body: 'text',
                query: 123,
                params: null,
                cookies: undefined
            };

            const expectedOutput = {
                method: 'GET',
                body: 'text',
                query: 123,
                params: null,
                cookies: undefined
            };

            expect(convertRequestData(req)).toEqual(expectedOutput);
        });
    });

    describe('Encryption and Decryption Tests', () => {

        // Mock environment setup
        process.env.SECRET_KEY = '0a06bb4c1e6d2b8f62ec71166d8997f588b3b3b1c313bbf14fcdfc9ba882827c';
        const ivHexString = 'b16bf361893a9a874671090a4c969ba6';
        const iv = Buffer.from(ivHexString, 'hex');
        const rawString = 'string';
        const base64Encrypted = 'eyJpdiI6ImIxNmJmMzYxODkzYTlhODc0NjcxMDkwYTRjOTY5YmE2IiwiY29udGVudCI6Ijc0ZmFhZjk0ZjE4YSJ9';

        test('encrypt should return a base64 string', () => {
            const encryted = encrypt(rawString, iv);
            expect(encryted).not.toBe(rawString);
            expect(typeof encryted).toBe('string');
            expect(encryted).toBe(base64Encrypted);
        });

        test('decrypt should return original string', () => {
            const decryted = decrypt(base64Encrypted);
            expect(typeof decryted).toBe('string');
            expect(decryted).toBe(rawString);
        });
    });

    describe('encryptObjectItems and decryptObjectItems', () => {

        test('should encrypt all string values in the object', () => {
            const inputObj = {
                firstName: 'John',
                lastName: 'Doe',
                contactInfo: {
                    emailAddress: 'john.doe@example.com',
                    phoneNumber: '1234567890'
                }
            };

            const encryptedObj = encryptObjectItems(inputObj);

            // Verify that all string values are different from the original
            expect(encryptedObj.firstName).not.toBe(inputObj.firstName);
            expect(encryptedObj.lastName).not.toBe(inputObj.lastName);
            expect(encryptedObj.contactInfo.emailAddress).not.toBe(inputObj.contactInfo.emailAddress);
            expect(encryptedObj.contactInfo.phoneNumber).not.toBe(inputObj.contactInfo.phoneNumber);
        });

        test('should decrypt all encrypted string values back to the original values', () => {
            const inputObj = {
                firstName: 'John',
                lastName: 'Doe',
                contactInfo: {
                    emailAddress: 'john.doe@example.com',
                    phoneNumber: '1234567890'
                }
            };

            const encryptedObj = encryptObjectItems(inputObj);
            const decryptedObj = decryptObjectItems(encryptedObj);

            // Verify that the decrypted object matches the original input object
            expect(decryptedObj).toEqual(inputObj);
        });

        test('should handle arrays of objects correctly', () => {
            const inputObj = [
                { firstName: 'John', lastName: 'Doe' },
                { firstName: 'Jane', lastName: 'Smith' }
            ];

            const encryptedObj = encryptObjectItems(inputObj);
            const decryptedObj = decryptObjectItems(encryptedObj);

            // Verify that the decrypted object matches the original input object
            expect(decryptedObj).toEqual(inputObj);

            // Verify that all string values in the encrypted object are different from the originals
            encryptedObj.forEach((obj, index) => {
                expect(obj.firstName).not.toBe(inputObj[index].firstName);
                expect(obj.lastName).not.toBe(inputObj[index].lastName);
            });
        });

        test('should not alter non-string values during encryption', () => {
            const date = new Date();
            const inputObj = {
                firstName: 'John',
                age: 30,
                isVerified: true,
                birthDate: date
            };

            const encryptedObj = encryptObjectItems(inputObj);
            const decryptedObj = decryptObjectItems(encryptedObj);

            // Verify that non-string values remain the same
            expect(decryptedObj.age).toBe(inputObj.age);
            expect(decryptedObj.isVerified).toBe(inputObj.isVerified);
            expect(decryptedObj.birthDate).toEqual(inputObj.birthDate);
        });
    });


});
