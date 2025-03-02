// plugin.ts
// example without renaming decorators
import fp from 'fastify-plugin';
import token from 'fastify-esso';

export default fp(async function (fastify, opts) {
    fastify.register(token({
        secret: process.env.AUTH as string,
        disable_headers: true,
        disable_query: true,
        header_name: "IMAT",
        token_prefix: null
    }));
});

// example with rename decorators
import fp from 'fastify-plugin';
import token from 'fastify-esso';

export default fp(async function (fastify, opts) {
    fastify.register(token({
        secret: process.env.COOKIE_AUTH as string,
        disable_headers: true,
        disable_query: true,
        header_name: "IMAT",
        token_prefix: null, // if you don't want token prefix
        rename_decorators: {
            auth: "test_auth",
            requireAuthentication: "require_test_auth",
            generateAuthToken: "generate_test_auth"
        }
    }));
});

declare module "fastify"{
	export interface FastifyInstance{
		require_test_auth: (arg0: FastifyInstance) => void;
        	generate_test_auth: (arg0: any) => Promise<string>;
	}
	export interface FastifyRequest {
		test_auth: any;
	}
}

// End of plugin.ts
			
			
// USAGE with rename decorators
// generate token
const token = await fastify.generate_test_auth({user: "anything"});

// require token
fastify.require_test_auth(fastify);

