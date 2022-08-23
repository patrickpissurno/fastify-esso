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

    /** Change the name of generateAuthToken decorator, useful if you want to register this package for different authentications */
    generateAuthToken_name: "generateAuthToken",

    /** Change the name of requireAuthentication decorator, useful if you want to register this package for different authentications */
    requireAuthentication_name: "requireAuthentication",

    /** Change the name of the request decorator, actual token will be available here once verified, useful if you want to register this package for different authentications */
    verifiedToken_data_name: "auth",

    /** Use custom prefix for your token, use false to disable it */
    token_prefix: "Bearer",

    /** Secure random key that will be used to do the encryption stuff */
    secret: '',
    
    /** Request header name / query parameter name / cookie name */
    header_name: 'authorization',

    /** Set this to true if you don't want to allow the token to be passed as a header */
    disable_headers: false,

    /** Set this to true if you don't want to allow the token to be passed as a query parameter */
    disable_query: false,

    /** Set this to true if you don't want to allow the token to be passed as a cookie */
    disable_cookies: false,
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

    if(opts.disable_headers && opts.disable_query && opts.disable_cookies)
        throw new Error('at least one of the following flags should be false: disable_headers, disable_query, disable_cookies');

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
            let field = null;
            if(!opts.disable_headers && req.headers[opts.header_name])
                field = req.headers[opts.header_name]
            else if(!opts.disable_query && req.query[opts.header_name])
                field = req.query[opts.header_name];
            else if(!opts.disable_cookies && req.cookies && req.cookies[opts.header_name])
                field = req.cookies[opts.header_name];

            if(!field)
                throw new err.Unauthorized();

            let token = field;

            if(default_opts.token_prefix){
                const parts = field.split(' ');

                if(parts.length !== 2 || parts[0] !== default_opts.token_prefix)
                    throw new err.Forbidden();

                token = parts[1];
            }

            try {
                const json = await decrypt(key, token);

                if(json === '`')
                    req[default_opts.verifiedToken_data_name] = { };
                else
                    req[default_opts.verifiedToken_data_name] = JSON.parse(json);
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
         * @returns { Promise<string> }
         */
        async function generateAuthToken(data){
            if(!data || Object.keys(data).length < 1){
                const token = !default_opts.token_prefix ? await encrypt(key, '`') : `${default_opts.token_prefix} ` + await encrypt(key, '`');
                return token; // we need to encrypt something, so let's just save bandwidth
            }

            const token = !default_opts.token_prefix ? await encrypt(key, JSON.stringify(data)) : `${default_opts.token_prefix} ` + await encrypt(key, JSON.stringify(data));
            return token;
        }
        
        fastify.decorate(default_opts.requireAuthentication_name, requireAuthentication);
        fastify.decorate(default_opts.generateAuthToken_name, generateAuthToken);

        done();
    }

    return fp((f, o, d) => plugin(f, o, d));
}