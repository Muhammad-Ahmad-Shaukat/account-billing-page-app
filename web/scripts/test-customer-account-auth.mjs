import '../load-env.js';
import assert from 'node:assert/strict';
import {SignJWT} from 'jose';
import {customerAccountAuth} from '../middleware/customer-account-auth.js';
import {runtimeConfig} from '../runtime-config.js';

const secret=Buffer.from(process.env.SHOPIFY_API_SECRET || 'test-only-secret');
async function token(claims,audience=runtimeConfig.apiKey) {
  return new SignJWT(claims).setProtectedHeader({alg:'HS256'}).setAudience(audience).setIssuedAt().setExpirationTime('2m').sign(secret);
}
async function authenticate(value) {
  const req={get:()=> value ? `Bearer ${value}` : ''};
  let status=200,payload,accepted=false;
  const res={status(code){status=code;return this;},json(value){payload=value;return this;}};
  await customerAccountAuth(req,res,()=>{accepted=true;});
  return {status,payload,accepted,req};
}
const dest='auth-test.myshopify.com';
const missing=await authenticate(await token({dest}));
assert.equal(missing.status,401);
assert.equal(missing.payload.code,'customer_identity_missing');
const valid=await authenticate(await token({dest,sub:'gid://shopify/Customer/123'}));
assert.equal(valid.accepted,true);
assert.equal(valid.req.loggedInCustomerId,'123');
const audience=await authenticate(await token({dest,sub:'gid://shopify/Customer/123'},'different-app'));
assert.equal(audience.payload.code,'invalid_customer_session');
assert.equal((await authenticate('not-a-valid-token')).payload.code,'invalid_customer_session');
console.log('Customer auth checks passed: verified identity, missing protected identity, wrong app audience, invalid token.');
