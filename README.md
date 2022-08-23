# fastify-esso
[![npm-version](https://img.shields.io/npm/v/fastify-esso.svg)](https://www.npmjs.com/package/fastify-esso)
[![build status](https://travis-ci.org/patrickpissurno/fastify-esso.svg?branch=master)](https://travis-ci.org/patrickpissurno/fastify-esso)
[![coverage status](https://coveralls.io/repos/github/patrickpissurno/fastify-esso/badge.svg?branch=master)](https://coveralls.io/github/patrickpissurno/fastify-esso?branch=master)
[![known vulnerabilities](https://snyk.io/test/github/patrickpissurno/fastify-esso/badge.svg)](https://snyk.io/test/github/patrickpissurno/fastify-esso)
[![downloads](https://img.shields.io/npm/dt/fastify-esso.svg)](http://npm-stats.com/~packages/fastify-esso)
[![license](https://img.shields.io/github/license/patrickpissurno/fastify-esso.svg?maxAge=1800)](https://github.com/patrickpissurno/fastify-esso/blob/master/LICENSE)

Hate boilerplate code? Want something fast and still impossible[<sup>[1]</sup>](https://crypto.stackexchange.com/questions/6712/is-aes-256-a-post-quantum-secure-cipher-or-not) to break?

Then, this plugin is for you.

This [`fastify`](https://www.fastify.io) plugin turns the usual authentication nightmare into **something easily manageable**.

And also has first-party support for TypeScript (completely optional). Thanks @dodiego for the PR!


<br>


## How authentication works in 3 simple steps:
We'll start out with the following sample scenario:
```js
// first let's import fastify and create a server instance
const fastify = require('fastify')();

// TODO: import the plugin
// TODO: implement our stuff

// let's start the server
fastify.listen(3000, '0.0.0.0', (err) => console.log(err ? err : 'Listening at 3000'));
```

### #1 - Credentials validation
Just like going to a party. In the entrance there is this guard. You can't just walk past her. You need to **show your ID** and then she'll **check if you were invited** (*eg.* have access).

This is not implemented by this plugin. But it is still quite simple. Let's write some sample code:
```js
fastify.post('/auth', async (req, reply) => {

    // are the credentials valid? (PS: if you copy-pasted this code, take a look at the full example below)
    const valid_credentials = req.body.user === 'John' && req.body.password === '123';
    if(!valid_credentials)
        return { message: 'Invalid credentials. You shall not pass!' };

    return { message: 'Access granted. Enjoy the party!' };
});
```

### #2 - Token generation
It turns out you were invited, so the guard proceeds to give you a party wristband (*eg.* token). But this is a tech party, so it has a built-in NFC chip that can store some info. Cool! 

This is implemented by this plugin! Let's take a look at the updated code:
```js
fastify.post('/auth', async (req, reply) => {

    // are the credentials valid? (PS: if you copy-pasted this code, take a look at the full example below)
    const valid_credentials = req.body.user === 'John' && req.body.password === '123';
    if(!valid_credentials)
        return { message: 'Invalid credentials. You shall not pass!' };
        
    // here we're storing who you are inside the wristband
    const wristband = await fastify.generateAuthToken({ user: req.body.user });

    return { message: 'Access granted. Enjoy the party!', wristband: wristband  };
});
```

### #3 - Token validation
You join the party and dance a lot. Now you're thirst, so what about a drink? The barman scans your wristband (*eg.* validates) and instantly knows who you are, so she proceeds to give you the drink. Sweet!

This is also implemented by this plugin! So let's update the example:
```js
async function privateRoutes(fastify){
    fastify.requireAuthentication(fastify); //this is where all the magic happens

    fastify.get('/order-drink', async (req, reply) => {
        return { message: 'Hello ' + req.auth.user + '. Here is your drink!' };
    });
}

// register our private routes
fastify.register(privateRoutes);
```

All you have to do is call `fastify.requireAuthentication(fastify)` or `fastify.the_name_you_used(fastify)` and every route inside the current fastify scope will require authentication to be accessed.

*You might want to take a deeper look into [how Fastify's scopes work](https://www.fastify.io/docs/latest/Getting-Started/#your-first-plugin).*

**Full example:**
```js
// first let's import fastify and create a server instance
const fastify = require('fastify')();

/**
 * Registers the plugin. 
 * In the real world you should change this secret
 * to something complex, with at least 20 characters
 * for it to be safe
 */
fastify.register(require('fastify-esso')({ secret: '11111111111111111111' }));

fastify.post('/auth', async (req, reply) => {

    // tip: checking passwords with === is vulnerable, so in production use crypto.timingSafeEqual instead
    const valid_credentials = req.body.user === 'John' && req.body.password === '123';
    if(!valid_credentials)
        return { message: 'Invalid credentials. You shall not pass!' };
        
    // here we're storing who you are inside the wristband
    const wristband = await fastify.generateAuthToken({ user: req.body.user });

    return { message: 'Access granted. Enjoy the party!', wristband: wristband  };
});

async function privateRoutes(fastify){
    // fastify.the_name_you_used(fastify)
    fastify.requireAuthentication(fastify); //this is where all the magic happens

    fastify.get('/order-drink', async (req, reply) => {
        return { message: 'Hello ' + req.auth.user + '. Here is your drink!' };
    });
}

// register our private routes
fastify.register(privateRoutes);

// let's start the server
fastify.listen(3000, '0.0.0.0', (err) => console.log(err ? err : 'Listening at 3000'));
```


<br><br>


## FAQ (Frequently Asked Questions)
### What does this plugin provide?
Actually, just two [decorators](https://www.fastify.io/docs/latest/Decorators/) to the Fastify server instance:

- `fastify.generateAuthToken(data)`  OR `fastify.the_name_you_used(data)`
 Call this function to generate an authentication token that grants access to routes that require authentication.  
  **Parameters**: 
  - `data`: an `object` (can contain any data) that will be [decorated](https://www.fastify.io/docs/latest/Decorators/) in the **request object** and can be accessed via `req.auth` OR `req.the_name_you_used` only for routes inside authenticated scopes.  
  
  **Returns**: a `Promise` that once resolved, turns into a `string` containing the token.  


- `fastify.requireAuthentication(fastify)`  OR `fastify.the_name_you_used(fastify)`
 Call this function to require authentication for every route inside the current [Fastify scope](https://www.fastify.io/docs/latest/Getting-Started/#your-first-plugin).  
  **Parameters**: 
  - `fastify`: the current [Fastify scope](https://www.fastify.io/docs/latest/Getting-Started/#your-first-plugin) that will now require authentication.
  
  **Returns**: nothing.  
  
### How does it work?
Symmetric encryption. This plugin uses the native Node.js `crypto` module to provide us with the military-grade[<sup>[2]</sup>](https://en.wikipedia.org/wiki/NSA_encryption_systems#Public_systems)‎[<sup>[3]</sup>](https://en.wikipedia.org/wiki/NSA_product_types#Type_1_product) encryption AES (Advanced Encryption Standard), with 256-bits key size and CBC mode (TL;DR: `aes-256-cbc`).

It works in a quite similar way to JWTs, but reducing overhead and providing data encryption (instead of simply signing it). 

When you call `await fastify.generateAuthToken({ user: 'Josh' })`, the library converts the data to JSON, and then encrypts it.

When the user uses this token (sends it in the request header, which defaults to `authorization` but that can be changed), this plugin will decrypt it and then decorate Fastify's **request object** with the original data.

By doing it this way we guarantee:
- That the user authenticated successfully (otherwise they wouldn't have been able to generate valid encrypted content, as they don't know the secret).  
  *JWT also gives you this*.
- That you don't need to access an external database, such as MySQL or Redis, just to verify whether the token is valid or not. This reduces latency and load in your databases.  
  *JWT also gives you this*
- That nobody, including the user, can change the data (it's encrypted after all).  
  *JWT also gives you this*
- That nobody, including the user, can view the data (without the encryption secret, it's just gibberish).  
  **JWT doesn't provide this**.
- That the data is disguised as a regular bearer token, and that no one will ever know[<sup>[1]</sup>](https://crypto.stackexchange.com/questions/6712/is-aes-256-a-post-quantum-secure-cipher-or-not) that it actually means something. (We use random IVs, so you'll never get repeated tokens, even if the data itself is the same[<sup>[4]</sup>](https://crypto.stackexchange.com/questions/3883/why-is-cbc-with-predictable-iv-considered-insecure-against-chosen-plaintext-atta)).  
  **JWT doesn't provide this**.
- Much more compact than JWTs, meaning less bandwidth usage. Still, we advise against storing a bunch of information in it. It's not because you can, that you should :)

### Is it safe?
We use the industry-standard[<sup>[2]</sup>](https://en.wikipedia.org/wiki/NSA_encryption_systems#Public_systems)‎[<sup>[3]</sup>](https://en.wikipedia.org/wiki/NSA_product_types#Type_1_product) symmetric encryption algorithm (**[AES-256-CBC](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)**) and a strong [key derivation function](https://en.wikipedia.org/wiki/Key_derivation_function), **[scrypt](https://en.wikipedia.org/wiki/Scrypt)**, to make it impossible to break[<sup>[5, p. 14]</sup>](https://www.tarsnap.com/scrypt/scrypt.pdf) as long as you **keep the secret safe**, and use one that is a random enough (*eg*. don't use 12345678 or anything like that).
The secret also has to have a length of at least 20 characters, otherwise this plugin will throw an error. We also use cryptographically-secure random IVs ([Initialization Vectors](https://en.wikipedia.org/wiki/Initialization_vector)). This way we end up with a very strong encryption.

So yeah, **this is really safe**.

### Is it tested?
We adhere to a **strict 100% coverage standard**. There are [continuous integration](https://en.wikipedia.org/wiki/Continuous_integration) tools in place. Which means that all tests are run with every commit. If any of them fail, or the code coverage isn't 100%, then it won't go to NPM. Simple as that. 

So yeah, **it's tested**.

### Great plugin, but what about [SSO and federated logins](https://en.wikipedia.org/wiki/Single_sign-on)?
Great question! In a [microservices](https://en.wikipedia.org/wiki/Microservices) architecture, services should be decoupled. How can you decouple stuff if you still need authentication in every one of them? There are two options:
#### Centralized Authentication Server (AS) example:
Let's say you have 3 microservices (X, Y and Z). You can create a single AS and make users authenticate directly with it.

It would work like this (without this plugin):
1. **User** <-> **AS** (authenticates and receives token)
2. **User** -> **X** (sends request plus token)
3. **X** <-> **AS** (validates token)
4. **User** <- **X** (sends the response back)

This would have **poor performance** (for every request to any microservice, there would be another request to the AS, causing it to suffer a big load) and a **single point-of-failure** (if the AS goes down, everything goes down too). It simply doesn't scale nor work great for distributed stuff.

Now let's make this right by using this plugin. It would work like this:
1. **User** <-> **AS** (authenticates and receives token)
2. **User** -> **X** (sends request plus token)
3. **X** (validates the token locally, with blazing fast speeds)
4. **User** <- **X** (sends the response back)

WOW! Now there is **no need to make any additional requests** to the AS, which means that the microservices don't even need to be connected to it by network. They can be **completely isolated from each other**.
Also, you can scale up as much as you can the number of microservices or instances, without requiring you to scale the AS. Sounds great to me!

In case of having different permissions for each microservice, or sensitive authentication info that needs to be passed from the AS to the microservices, you would just have to put it inside the token, and rest assured: **it's safe**. Amazing, right?

#### Distributed Authentication example:
Let's say you have 3 microservices (X, Y and Z). Now you won't create a dedicated AS. Instead, users will authenticate directly with each microservice.

It would work like this (without this plugin, W means *any* microservice):
1. **User** <-> **W** (authenticates and receives token)
2. **User** -> **X** (sends request plus token)
3. **X** <-> **DB** (validates token by making a network request to a database)
4. **User** <- **X** (sends the response back)

It would be complicated to implement, as a lot of code would be repeated, and a huge standardization would have to take place to make sure that each microservice would implement authentication and validation the same way.
Also, it would incur in a big overhead to the authentication database. Not that great.

In general, the first approach (Centralized Authentication Server) is better. But we can still improve on this one to make it more viable, if for some reason it suits you better.

Improved approach (using this plugin, W means *any* microservice):
1. **User** <-> **W** (authenticates and receives token)
2. **User** -> **X** (sends request plus token)
3. **X** (validates the token locally, with blazing fast speeds)
4. **User** <- **X** (sends the response back)

In this last example, the main advantages of using this plugin are:
- Much reduced database and network load
- Most of the boilerplate code and standardization is already handled by the plugin, making it much easier to maintain

### Conclusion

In almost every situation, this plugin helps improve stuff. So yeah, you should be using it. And I'm aware that there are other Fastify plugins for authentication (even official ones).
But after reading through all of this, you're probably aware of why this one is the one authentication plugin you should be using.

### References
1. [Is AES-256 a post-quantum secure cipher or not?](https://crypto.stackexchange.com/questions/6712/is-aes-256-a-post-quantum-secure-cipher-or-not)
2. [NSA Encryption Systems - Advanced Encryption Standard (AES)](https://en.wikipedia.org/wiki/NSA_encryption_systems#Public_systems)
3. [NSA product types - Type 1 product](https://en.wikipedia.org/wiki/NSA_product_types#Type_1_product)
4. [Why should you use CBC with random IVs](https://crypto.stackexchange.com/questions/3883/why-is-cbc-with-predictable-iv-considered-insecure-against-chosen-plaintext-atta)
5. [Stronger Key Derivation Via Sequential
Memory-hard Functions](https://www.tarsnap.com/scrypt/scrypt.pdf) (page 14, "Estimated cost of hardware to crack a password in 1 year")


<br><br>


## API Reference

### Register
```js
const opts = {
    /** request header name and/or query parameter name and/or cookie name */
    header_name: 'authentication' // defaults to 'authentication'
    
    secret: '11111111111111111111', // cannot be ommited
    
    /** request and reply are Fastify's request and reply **/
    extra_validation: async function validation (request, reply){ // can be ommited
        /**
         * Custom validation function that is called after basic validation is executed
         * This function should throw in case validation fails
         * req.auth is already available here
         */
    },

    /** Change the name of generateAuthToken decorator, useful if you want to register this package for different authentications */
    generateAuthToken_name: "generateAuthToken",

    /** Change the name of requireAuthentication decorator, useful if you want to register this package for different authentications */
    requireAuthentication_name: "requireAuthentication",

    /** Change the name of the request decorator, actual token will be available here once verified, useful if you want to register this package for different authentications */
    verifiedToken_data_name: "auth",

    /** Use custom prefix for your token, use false to disable it */
    token_prefix: "Bearer",

    /** set this to true if you don't want to allow the token to be passed as a header */
    disable_headers: false,

    /** set this to true if you don't want to allow the token to be passed as a query parameter */
    disable_query: false,

    /** set this to true if you don't want to allow the token to be passed as a cookie */
    disable_cookies: false,
};

fastify.register(require('fastify-esso')(opts));
```

<br>

### fastify.generateAuthToken(data)
Call this function to generate an authentication token that grants access to routes that require authentication.  

**Parameters**: 
  - `data`: an `object` (can contain any data) that will be [decorated](https://www.fastify.io/docs/latest/Decorators/) in the **request object** and can be accessed via `req.auth` only for routes inside authenticated scopes.  
  
**Returns**: a `Promise` that once resolved, turns into a `string` containing the token.  

<br>

### fastify.requireAuthentication(fastify)  
Call this function to require authentication for every route inside the current [Fastify scope](https://www.fastify.io/docs/latest/Getting-Started/#your-first-plugin).  

**Parameters**: 
  - `fastify`: the current [Fastify scope](https://www.fastify.io/docs/latest/Getting-Started/#your-first-plugin) that will now require authentication.
  
**Returns**: nothing.  


<br><br>


## Benchmarks
None yet. But you're welcome to open a PR.


<br>


## TODO

* [x] Add unit tests
* [x] Add integration tests
* [x] Coverage 100%
* [x] Add first-party TypeScript support
* [ ] Add benchmarks


<br>



## License
MIT License

Copyright (c) 2020-2021 Patrick Pissurno

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
