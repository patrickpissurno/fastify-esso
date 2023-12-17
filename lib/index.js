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
     * @param { import('fastify').FastifyRequest } request fastify request object
     * @param { import('fastify').FastifyReply } reply  fastify reply object
     */
    extra_validation: /* istanbul ignore next */ async function validation(request, reply) {
        //by default does nothing
    },

    /** Secure key that will be used to do the encryption stuff */
    secret: '',

    /** Request header name / query parameter name / cookie name */
    header_name: 'authorization',

    /** Set this to true if you don't want to allow the token to be passed as a header */
    disable_headers: false,

    /** Set this to true if you don't want to allow the token to be passed as a query parameter */
    disable_query: false,

    /** Set this to true if you don't want to allow the token to be passed as a cookie */
    disable_cookies: false,

    /** Sets the token prefix, by default `'Bearer '` is used. A null value means no prefix */
    token_prefix: 'Bearer ',

    /**
     * Allows for renaming the decorators this plugin adds to Fastify.
     * Useful if you want to register this plugin multiple times in the same scope
     * (not usually needed, but can be useful sometimes).
     * 
     * Note: if using TypeScript and intending to use this feature, you'll probably
     * want to add type definitions for the renamed decorators, otherwise it might complain
     * that they don't exist.
     * */
    rename_decorators: {
        /** Change the name of the `FastifyInstance.requireAuthentication` decorator */
        requireAuthentication: 'requireAuthentication',

        /** Change the name of the `FastifyInstance.generateAuthToken` decorator */
        generateAuthToken: 'generateAuthToken',

        /** Change the name of the `FastifyRequest.auth` decorator */
        auth: 'auth',
    }
};

module.exports = function builder(opts = default_opts) {
    if (opts.rename_decorators)
        opts.rename_decorators = Object.assign({}, default_opts.rename_decorators, opts.rename_decorators);
    opts = Object.assign({}, default_opts, opts);

    if (!opts.header_name)
        throw new Error('header_name cannot be null');

    if (typeof (opts.header_name) !== 'string')
        throw new Error('header_name should be a string');

    if (!opts.secret || opts.secret.length < 20)
        throw new Error('the secret cannot be null and should have at least 20 characters to be considered secure');

    if (opts.extra_validation != null && typeof (opts.extra_validation) !== 'function')
        throw new Error('extra validation should be either null or a function');

    if (opts.disable_headers && opts.disable_query && opts.disable_cookies)
        throw new Error('at least one of the following flags should be false: disable_headers, disable_query, disable_cookies');

    if (opts.token_prefix != null && typeof (opts.token_prefix) !== 'string')
        throw new Error('token_prefix should be either null or a string');

    if (!opts.rename_decorators.auth || typeof (opts.rename_decorators.auth) !== 'string')
        throw new Error('rename_decorators.auth should be a non empty string');

    if (!opts.rename_decorators.generateAuthToken || typeof (opts.rename_decorators.generateAuthToken) !== 'string')
        throw new Error('rename_decorators.generateAuthToken should be a non empty string');

    if (!opts.rename_decorators.requireAuthentication || typeof (opts.rename_decorators.requireAuthentication) !== 'string')
        throw new Error('rename_decorators.requireAuthentication should be a non empty string');

    if (opts.rename_decorators.generateAuthToken === opts.rename_decorators.requireAuthentication)
        throw new Error('rename_decorators.generateAuthToken and rename_decorators.requireAuthentication should have distinct values');

    /**
     * @param { import('fastify').FastifyInstance } fastify 
     * @param { any } options 
     * @param { function } done 
     */
    async function plugin(fastify, options, done) {
        const key = await scryptAsync(opts.secret, opts.header_name, 32);

        /**
         * Custom validation function that is called after basic validation is ensured
         * @param { import('fastify').FastifyRequest } req fastify request
         * @param { import('fastify').FastifyReply } reply  fastify reply
         */
        async function validation(req, reply) {
            /** @type { string } */
            let field = null;
            if (!opts.disable_headers && req.headers[opts.header_name])
                field = req.headers[opts.header_name]
            else if (!opts.disable_query && req.query[opts.header_name])
                field = req.query[opts.header_name];
            else if (!opts.disable_cookies && req.cookies && req.cookies[opts.header_name])
                field = req.cookies[opts.header_name];

            if (!field)
                throw new err.Unauthorized();

            /** @type { string } */
            let token;

            if (opts.token_prefix != null) {
                if (field.substring(0, opts.token_prefix.length) !== opts.token_prefix)
                    throw new err.Forbidden();

                token = field.substring(opts.token_prefix.length, field.length);
            }
            else
                token = field;

            try {
                const json = await decrypt(key, token);

                if (json === '`')
                    req[opts.rename_decorators.auth] = {};
                else
                    req[opts.rename_decorators.auth] = JSON.parse(json);
            }
            catch (ex) {
                throw new err.Forbidden();
            }

            if (opts.extra_validation != null)
                await opts.extra_validation(req, reply);
        }

        /**
         * Function to manage authentication within Fastify routes or hooks
         * https://www.fastify.io/docs/latest/Plugins/
         @param {...any} args Accepts multiple arguments:
         *   - If a single argument is provided it is considered as Fastify instance, it sets up a hook for authentication.
         *   - If two arguments are provided, they are considered as Fastify request and reply for direct validation.
         */
        async function requireAuthentication(...args) {
            if (args.length === 1) {
                const [fastify] = args;
                if (fastify && typeof fastify.addHook === 'function') {
                    fastify.addHook('preHandler', validation);
                } else {
                    throw new Error('Invalid Fastify instance provided');
                }

            }

            else if (args.length === 2) {
                const [request, reply] = args;
                if (request && reply) {
                    await validation(request, reply);
                } else {
                    throw new Error('Both request and reply instances are required');
                }
            }

            else {
                throw new Error('Invalid number of arguments provided');
            }
        }

        /**
         * Call this function to generate an authentication token that grants access to routes that require authentication
         * @param { object } data This data will be made available in request.auth for routes inside an authenticated scope
         * @returns { Promise<string> }
         */
        async function generateAuthToken(data) {
            const prefix = opts.token_prefix != null ? opts.token_prefix : '';

            if (!data || Object.keys(data).length < 1)
                return prefix + await encrypt(key, '`'); // we need to encrypt something, so let's just save bandwidth

            return prefix + await encrypt(key, JSON.stringify(data));
        }

        fastify.decorate(opts.rename_decorators.requireAuthentication, requireAuthentication);
        fastify.decorate(opts.rename_decorators.generateAuthToken, generateAuthToken);

        done();
    }

    return fp((f, o, d) => plugin(f, o, d));
}
