const { promisify } = require('util');
const crypto = require('crypto');
const randomBytesAsync = promisify(crypto.randomBytes);

module.exports = {
    encrypt,
    decrypt
};

/**
 * Turns cleartext into ciphertext
 * @param { Buffer } key 
 * @param { string } data 
 * @returns { Promise<string> }
 */
async function encrypt(key, data){
    const iv = await randomBytesAsync(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    return new Promise((resolve, reject) => {
        let encrypted = '';
        cipher.on('readable', () => {
            let chunk;
            while (null !== (chunk = cipher.read())) {
                encrypted += chunk.toString('hex');
            }
        });
        cipher.on('end', () => {
            // iv in hex format will always have 32 characters
            resolve(iv.toString('hex') + encrypted);
        });
        cipher.on('error', reject);

        cipher.write(data);
        cipher.end();
    });
}

/**
 * Turns ciphertext into cleartext
 * @param { Buffer } key 
 * @param { string } data 
 * @returns { Promise<string> }
 */
async function decrypt(key, data){
    if(!data || data.length < 32) // iv in hex format will always have 32 characters
        throw new Error('Invalid data');

    const iv = Buffer.from(data.substring(0, 32), 'hex');
    const encrypted = data.substring(32, data.length);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    return new Promise((resolve, reject) => {
        let chunk;
        let decrypted = '';
        decipher.on('readable', () => {
            while (null !== (chunk = decipher.read())) {
                decrypted += chunk.toString('utf8');
            }
        });
        decipher.on('end', () => resolve(decrypted));
        decipher.on('error', reject);

        decipher.write(encrypted, 'hex');
        decipher.end();
    });
}