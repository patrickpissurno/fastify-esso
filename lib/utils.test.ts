import tap, { type Test } from 'tap';
import crypto from 'crypto';
import { encrypt, decrypt } from './utils';

const key = crypto.scryptSync('1'.repeat(20), 'salt', 32);

tap.test('encrypt', encryption);
tap.test('decrypt', decryption);
tap.test('encrypt-then-decrypt', encrypt_then_decrypt);

function encryption(tap: Test){
    tap.resolves(() => encrypt(key, ''), `encrypt('') doesn't throw`);
    tap.resolves(() => encrypt(key, '1'.repeat(2000)), `encrypt('...') w/ big string doesn't throw`);
    tap.end();
}

function decryption(tap: Test){
    tap.rejects(() => decrypt(key, ''), `decrypt('') empty string throws`);
    tap.rejects(() => decrypt(key, '1'.repeat(31)), `decrypt('') w/ string length < 32 throws`);
    tap.rejects(() => decrypt(key, '1'.repeat(50)), `decrypt('') w/ invalid data throws`);
    tap.rejects(() => decrypt(key, '1'.repeat(51)), `decrypt('') w/ invalid data throws`);
    tap.end();
}

async function encrypt_then_decrypt(tap: Test){
    const original = 'here is some data';
    const encrypted = await encrypt(key, original);
    const decrypted = await decrypt(key, encrypted);

    tap.equal(decrypted, original, 'decrypted data should match original data');
}
