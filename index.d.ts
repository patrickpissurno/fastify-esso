import * as fastify from 'fastify';
import * as http from 'http';

export interface EssoOptions {

    /**
     * Custom validation function that is called after basic validation is executed.
     * This function should throw in case validation fails
     * */
    extra_validation?: (
        request: fastify.FastifyRequest,
        reply: fastify.FastifyReply
    ) => Promise;

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
    token_prefix?: string;

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

declare module 'fastify' {
    interface FastifyRequest<HttpRequest> {
        auth: any;
    }
    /** Add essoSecrets setter */
    interface FastifyInstance {
        generateAuthToken: function (any): Promise<string>;
        requireAuthentication: function (FastifyInstance): void;
        essoSecrets?: [string, string];
        setEssoSecret(key: string, value: any): void;
    }
}

declare const fastifyEsso: (options: EssoOptions) => fastify.Plugin<
    http.Server,
    http.IncomingMessage,
    http.ServerResponse,
    {}
>;

export = fastifyEsso;