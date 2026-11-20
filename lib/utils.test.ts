const tap = require('tap');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./utils');

const key = crypto.scryptSync('1'.repeat(20), 'salt', 32);

tap.test('encrypt', [], encryption);
tap.test('decrypt', [], decryption);
tap.test('encrypt-then-decrypt', [], encrypt_then_decrypt);

/** @param { tap } tap */
function encryption(tap){
    tap.resolves(() => encrypt(key, ''), `encrypt('') doesn't throw`);
    tap.resolves(() => encrypt(key, '1'.repeat(2000)), `encrypt('...') w/ big string doesn't throw`);
    tap.end();
}

/** @param { tap } tap */
function decryption(tap){
    tap.rejects(() => decrypt(key, ''), `decrypt('') empty string throws`);
    tap.rejects(() => decrypt(key, '1'.repeat(31)), `decrypt('') w/ string length < 32 throws`);
    tap.rejects(() => decrypt(key, '1'.repeat(50)), `decrypt('') w/ invalid data throws`);
    tap.rejects(() => decrypt(key, '1'.repeat(51)), `decrypt('') w/ invalid data throws`);
    tap.end();
}

/** @param { tap } tap */
async function encrypt_then_decrypt(tap){
    const original = 'here is some data';
    const encrypted = await encrypt(key, original);
    const decrypted = await decrypt(key, encrypted);

    tap.equal(decrypted, original, 'decrypted data should match original data');
}
