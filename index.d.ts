import * as fastify from "fastify";
import * as http from "http";
export interface EssoOptions {
  secret: string;
  header_name?: string;
  disable_headers?: boolean;
  disable_query?: boolean;
  disable_cookies?: boolean;
  extra_validation?: (
    request: fastify.FastifyRequest,
    reply: fastify.FastifyReply
  ) => Promise;
}

declare module "fastify" {
  interface FastifyRequest<HttpRequest> {
    auth: any;
  }

  interface FastifyInstance {
    generateAuthToken;
    requireAuthentication;
  }
}

declare const fastifySensible: function (EssoOptions) : fastify.Plugin<
  http.Server,
  http.IncomingMessage,
  http.ServerResponse,
  {}
>;

export = fastifySensible;
