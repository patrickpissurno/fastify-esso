const fastify = require('fastify')();
const err = require('http-errors');

fastify.register(require('.')({ secret: '11111111111111111111' }));

/** @param { import('fastify').FastifyInstance } fastify */
async function routes(fastify){
    fastify.get('/', async (req, reply) => {
        return { public: true };
    });
    
    fastify.post('/auth', async (req, reply) => {
        const valid_credentials = req.body.user === 'John' && req.body.password === '123'; //never use this in production (unsafe). instead, use crypto.timingSafeEqual
        if(!valid_credentials)
            throw new err.Forbidden();

        const token = await fastify.generateAuthToken({ user: req.body.user }); // you can add as much data as you want here, but keep in mind: the less, the faster
        //Bearer 2ead6b62dec72e4c5c50a0e3578fc746e29eb2d374b9d21f655cc35710d09c99

        return { token };
    });

    fastify.register(privateRoutes);
}

/** @param { import('fastify').FastifyInstance } fastify */
async function privateRoutes(fastify){
    fastify.requireAuthentication(fastify);

    fastify.get('/test', async  (req, reply) => {
        return { private: true, message: 'Hello, ' + req.auth.user + '!' };
    });
}

fastify.register(routes);

fastify.listen(3000, '0.0.0.0', (err) => console.log(err ? err : 'Listening at 3000'));