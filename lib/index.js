const fp = require('fastify-plugin');
const err = require('http-errors');
const { promisify } = require('util');
const crypto = require('crypto');
const scryptAsync = promisify(crypto.scrypt);
const randomBytesAsync = promisify(crypto.randomBytes);

const default_opts = {
    /**
     * Custom validation function that is called after basic validation is executed
     * This function should throw in case validation fails
     * @param { import('fastify').FastifyRequest } request fastify request
     * @param { import('fastify').FastifyReply } reply  fastify reply
     */
    extra_validation: async function validation (request, reply){
        //does nothing
    },
    header_name: 'authorization',
    secret: ''
};

module.exports = function builder(opts = default_opts){
    opts = Object.assign({}, default_opts, opts);

    if(!opts.header_name)
        throw new Error('header_name cannot be null');

    if(!opts.secret || opts.secret.length < 20)
        throw new Error('the secret cannot be null and should have at least 20 characters to be considered secure');

    if(opts.extra_validation != null && typeof(opts.extra_validation) !== 'function')
        throw new Error('extra validation should be either null or a function');

    /**
     * @param { import('fastify').FastifyInstance } fastify 
     * @param { any } options 
     * @param { function } done 
     */
    async function plugin (fastify, options, done) {
        const key = await scryptAsync(opts.secret, opts.header_name, 32);

        /**
         * Custom validation function that is called after basic validation is ensured
         * @param { import('fastify').FastifyRequest } req fastify request
         * @param { import('fastify').FastifyReply } reply  fastify reply
         */
        async function validation(req, reply){
            /** @type { string } */
            const field = req.headers[opts.header_name] ? req.headers[opts.header_name] : req.query[opts.header_name];

            if(!field)
                throw new err.Unauthorized();

            const parts = field.split(' ');

            if(parts.length !== 2 || parts[0] !== 'Bearer')
                throw new err.Forbidden();

            const token = parts[1];
            try {
                const json = await decrypt(key, token);
                const data = JSON.parse(json);

                req.auth = data;
            }
            catch(ex){
                throw new err.Forbidden();
            }

            if(opts.extra_validation != null)
                await opts.extra_validation(req, reply)
        }

        /** 
         * Call this function to require authentication for every route inside a Fastify Scope
         * https://www.fastify.io/docs/latest/Plugins/
         * @param { import('fastify').FastifyInstance } fastify
         */
        function requireAuthentication(fastify){
            fastify.addHook('onRequest', validation);
        }

        /**
         * Call this function to generate an authentication token that grants access to routes that require authentication
         * @param { object } data This data will be made available in request.auth for routes inside an authenticated scope
         * @returns { string }
         */
        async function generateAuthToken(data){
            return 'Bearer ' + await encrypt(key, JSON.stringify(data));
        }
        
        fastify.decorate('requireAuthentication', requireAuthentication);
        fastify.decorate('generateAuthToken', generateAuthToken);

        done();
    }

    return fp((f, o, d) => plugin(f, o, d));
}

/**
 * Turns cleartext into ciphertext
 * @param { Buffer } key 
 * @param { string } data 
 * @returns { string }
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
 * @returns { string }
 */
async function decrypt(key, data){
    if(!data || data.length < 32) // iv in hex format will always have 32 characters
        return null;

    const iv = Buffer.from(data.substring(0, 32), 'hex');
    const encrypted = data.substring(32, data.length);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    return new Promise((resolve, reject) => {
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