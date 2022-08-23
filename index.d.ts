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
     * Sets the token prefix, by default 'Bearer ' is used. A null value means no prefix
     * @default 'Bearer '
     */
     token_prefix?: string;
}

declare module 'fastify' {
    interface FastifyRequest<HttpRequest> {
        auth: any;
    }

    interface FastifyInstance {
        generateAuthToken: function (any): Promise<string>;
        requireAuthentication: function (FastifyInstance): void;
    }
}

declare const fastifyEsso: (options: EssoOptions) => fastify.Plugin<
    http.Server,
    http.IncomingMessage,
    http.ServerResponse,
    {}
>;

export = fastifyEsso;