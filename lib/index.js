const fp = require('fastify-plugin');
const err = require('http-errors');
const { promisify } = require('util');
const crypto = require('crypto');
const scryptAsync = promisify(crypto.scrypt);
const { encrypt, decrypt } = require('./utils');

const default_opts = {
    /**
     * Custom validation function that is called after basic validation is executed
     * This function should throw in case validation fails
     * @param { import('fastify').FastifyRequest } request fastify request
     * @param { import('fastify').FastifyReply } reply  fastify reply
     */
    extra_validation: /* istanbul ignore next */ async function validation (request, reply){
        //does nothing
    },
    header_name: 'authorization',
    secret: ''
};

module.exports = function builder(opts = default_opts){
    opts = Object.assign({}, default_opts, opts);

    if(!opts.header_name)
        throw new Error('header_name cannot be null');

    if(typeof(opts.header_name) !== 'string')
        throw new Error('header_name should be a string');

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

                if(json === '`')
                    req.auth = { };
                else
                    req.auth = JSON.parse(json);
            }
            catch(ex){
                throw new err.Forbidden();
            }

            if(opts.extra_validation != null)
                await opts.extra_validation(req, reply);
        }

        /** 
         * Call this function to require authentication for every route inside a Fastify Scope
         * https://www.fastify.io/docs/latest/Plugins/
         * @param { import('fastify').FastifyInstance } fastify
         */
        function requireAuthentication(fastify){
            fastify.addHook('preHandler', validation);
        }

        /**
         * Call this function to generate an authentication token that grants access to routes that require authentication
         * @param { object } data This data will be made available in request.auth for routes inside an authenticated scope
         * @returns { string }
         */
        async function generateAuthToken(data){
            if(!data || Object.keys(data).length < 1)
                return 'Bearer ' + await encrypt(key, '`'); // we need to encrypt something, so let's just save bandwidth

            return 'Bearer ' + await encrypt(key, JSON.stringify(data));
        }
        
        fastify.decorate('requireAuthentication', requireAuthentication);
        fastify.decorate('generateAuthToken', generateAuthToken);

        done();
    }

    return fp((f, o, d) => plugin(f, o, d));
}