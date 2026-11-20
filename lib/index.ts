import fp from 'fastify-plugin';
import err from 'http-errors';
import { promisify } from 'util';
import crypto from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { encrypt, decrypt } from './utils';

const scryptAsync = promisify(crypto.scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

declare module 'fastify' {
    /**
     * Data stored in the token, available in `request.auth`.
     * Add your own fields with declaration merging: `declare module 'fastify' { interface EssoAuth { user: string } }`
     */
    interface EssoAuth {}

    interface FastifyRequest {
        auth: EssoAuth;
    }

    interface FastifyInstance {
        /**
         * Call this function to generate an authentication token that grants access to routes that require authentication
         * @param data This data will be made available in request.auth for routes inside an authenticated scope
         */
        generateAuthToken(data?: object): Promise<string>;

        /**
         * Call this function to require authentication for every route inside a Fastify Scope
         * https://www.fastify.io/docs/latest/Plugins/
         */
        requireAuthentication(fastify: FastifyInstance): void;
    }
}

namespace fastifyEsso {
    export interface EssoOptions {

        /**
         * Custom validation function that is called after basic validation is executed.
         * This function should throw in case validation fails
         * */
        extra_validation?: ((request: FastifyRequest, reply: FastifyReply) => Promise<void>) | null;

        /** Secure key that will be used to do the encryption stuff (cannot be ommited) */
        secret: string;

        /**
         * Request header name / query parameter name / cookie name. Defaults to 'authorization'
         * @default 'authorization'
         */
        header_name?: string;

        /**
         * Set this to true if you don't want to allow the token to be passed as a header
         * @default false
         */
        disable_headers?: boolean;

        /**
         * Set this to true if you don't want to allow the token to be passed as a query parameter
         * @default false
         */
        disable_query?: boolean;

        /**
         * Set this to true if you don't want to allow the token to be passed as a cookie
         * @default false
         */
        disable_cookies?: boolean;

        /**
         * Sets the token prefix, by default `'Bearer '` is used. A null value means no prefix
         * @default 'Bearer '
         */
        token_prefix?: string | null;

        /**
         * Allows for renaming the decorators this plugin adds to Fastify.
         * Useful if you want to register this plugin multiple times in the same scope
         * (not usually needed, but can be useful sometimes).
         *
         * Note: if using TypeScript and intending to use this feature, you'll probably
         * want to add type definitions for the renamed decorators, otherwise it might complain
         * that they don't exist.
         * */
        rename_decorators?: EssoRenameDecoratorsOptions;

    }

    export interface EssoRenameDecoratorsOptions {

        /**
         * Change the name of the `FastifyInstance.requireAuthentication` decorator
         * @default 'requireAuthentication'
         */
        requireAuthentication?: string;

        /**
         * Change the name of the `FastifyInstance.generateAuthToken` decorator
         * @default 'generateAuthToken'
         */
        generateAuthToken?: string;

        /**
         * Change the name of the `FastifyRequest.auth` decorator
         * @default 'auth'
         */
        auth?: string;

    }
}

type ResolvedOptions = Required<Omit<fastifyEsso.EssoOptions, 'rename_decorators'>> & {
    rename_decorators: Required<fastifyEsso.EssoRenameDecoratorsOptions>;
};

const default_opts: ResolvedOptions = {
    /**
     * Custom validation function that is called after basic validation is executed
     * This function should throw in case validation fails
     * @param request fastify request object
     * @param reply  fastify reply object
     */
    extra_validation: /* istanbul ignore next */ async function validation (request, reply){
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

function resolveOptions(options: fastifyEsso.EssoOptions = default_opts): ResolvedOptions {
    if(options.rename_decorators)
        options.rename_decorators = Object.assign({}, default_opts.rename_decorators, options.rename_decorators);
    const opts: ResolvedOptions = Object.assign({}, default_opts, options) as ResolvedOptions;

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

    if(opts.token_prefix != null && typeof(opts.token_prefix) !== 'string')
        throw new Error('token_prefix should be either null or a string');

    if(!opts.rename_decorators.auth || typeof(opts.rename_decorators.auth) !== 'string')
        throw new Error('rename_decorators.auth should be a non empty string');

    if(!opts.rename_decorators.generateAuthToken || typeof(opts.rename_decorators.generateAuthToken) !== 'string')
        throw new Error('rename_decorators.generateAuthToken should be a non empty string');

    if(!opts.rename_decorators.requireAuthentication || typeof(opts.rename_decorators.requireAuthentication) !== 'string')
        throw new Error('rename_decorators.requireAuthentication should be a non empty string');

    if(opts.rename_decorators.generateAuthToken === opts.rename_decorators.requireAuthentication)
        throw new Error('rename_decorators.generateAuthToken and rename_decorators.requireAuthentication should have distinct values');

    return opts;
}

/**
 * @param fastify 
 * @param options 
 */
async function fastifyEsso (fastify: FastifyInstance, options: fastifyEsso.EssoOptions) {
    const opts = resolveOptions(options);
    const key = await scryptAsync(opts.secret, opts.header_name, 32);

    /**
     * Custom validation function that is called after basic validation is ensured
     * @param req fastify request
     * @param reply  fastify reply
     */
    async function validation(req: FastifyRequest, reply: FastifyReply){
        const query = req.query as Record<string, string | undefined>;
        const cookies = (req as FastifyRequest & { cookies?: Record<string, string | undefined> }).cookies;

        let field: string | null = null;
        if(!opts.disable_headers && req.headers[opts.header_name])
            field = req.headers[opts.header_name] as string;
        else if(!opts.disable_query && query[opts.header_name])
            field = query[opts.header_name] as string;
        else if(!opts.disable_cookies && cookies && cookies[opts.header_name])
            field = cookies[opts.header_name] as string;

        if(!field)
            throw new err.Unauthorized();

        let token: string;

        if(opts.token_prefix != null){
            if(field.substring(0, opts.token_prefix.length) !== opts.token_prefix)
                throw new err.Forbidden();

            token = field.substring(opts.token_prefix.length, field.length);
        }
        else
            token = field;

        try {
            const json = await decrypt(key, token);

            if(json === '`')
                Reflect.set(req, opts.rename_decorators.auth, { });
            else
                Reflect.set(req, opts.rename_decorators.auth, JSON.parse(json));
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
     * @param fastify
     */
    function requireAuthentication(fastify: FastifyInstance){
        fastify.addHook('preHandler', validation);
    }

    /**
     * Call this function to generate an authentication token that grants access to routes that require authentication
     * @param data This data will be made available in request.auth for routes inside an authenticated scope
     */
    async function generateAuthToken(data?: object){
        const prefix = opts.token_prefix != null ? opts.token_prefix : '';

        if(!data || Object.keys(data).length < 1)
            return prefix + await encrypt(key, '`'); // we need to encrypt something, so let's just save bandwidth

        return prefix + await encrypt(key, JSON.stringify(data));
    }

    fastify.decorate(opts.rename_decorators.requireAuthentication, requireAuthentication);
    fastify.decorate(opts.rename_decorators.generateAuthToken, generateAuthToken);
}

fp(fastifyEsso, { fastify: '4.x || 5.x', name: 'fastify-esso' });

export = fastifyEsso;
