import * as fastify from 'fastify';
import * as http from 'http';

export interface EssoOptions {
    /** Secure random key that will be used to do the encryption stuff */
    secret: string;

    /** Request header name / query parameter name / cookie name */
    header_name?: string;

    /** Set this to true if you don't want to allow the token to be passed as a header */
    disable_headers?: boolean;

    /** Set this to true if you don't want to allow the token to be passed as a query parameter */
    disable_query?: boolean;

    /** Set this to true if you don't want to allow the token to be passed as a cookie */
    disable_cookies?: boolean;

    /** Custom validation function that is called after basic validation is executed */
    extra_validation?: (
        request: fastify.FastifyRequest,
        reply: fastify.FastifyReply
    ) => Promise;
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

declare const fastifySensible: (options: EssoOptions) => fastify.Plugin<
    http.Server,
    http.IncomingMessage,
    http.ServerResponse,
    {}
>;

export = fastifySensible;