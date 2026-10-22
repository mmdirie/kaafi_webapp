import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequireAuth } from '../src/middleware/auth.js';
import { requireBusinessRoles } from '../src/middleware/authorization.js';

function responseRecorder() {
  const res = {};
  return res;
}

function request(headers = {}) {
  return {
    params: {},
    get(name) {
      return headers[name.toLowerCase()];
    }
  };
}

test('authentication rejects a missing bearer token', async () => {
  let forwarded;
  const middleware = createRequireAuth({
    createClient() {
      throw new Error('client must not be created without a token');
    },
    projectUrl: 'https://example.supabase.co'
  });

  await middleware(request(), responseRecorder(), (error) => { forwarded = error; });

  assert.equal(forwarded.status, 401);
  assert.equal(forwarded.code, 'AUTH_REQUIRED');
});

test('authentication rejects invalid access tokens', async () => {
  const middleware = createRequireAuth({
    createClient() {
      return {
        auth: {
          async getUser() {
            return { data: { user: null }, error: { status: 401 } };
          }
        }
      };
    },
    projectUrl: 'https://example.supabase.co'
  });
  let forwarded;

  await middleware(request({ authorization: 'Bearer invalid-token' }), responseRecorder(), (error) => {
    forwarded = error;
  });

  test('authentication reports Supabase outages distinctly from invalid tokens', async () => {
    const middleware = createRequireAuth({
      createClient() {
        return {
          auth: {
            async getUser() {
              return { data: { user: null }, error: { status: 500 } };
            }
          }
        };
      }
    });
    let forwarded;

    await middleware(request({ authorization: 'Bearer token' }), responseRecorder(), (error) => {
      forwarded = error;
    });

    assert.equal(forwarded.status, 503);
    assert.equal(forwarded.code, 'AUTH_PROVIDER_UNAVAILABLE');
  });

  assert.equal(forwarded.status, 401);
  assert.equal(forwarded.code, 'INVALID_ACCESS_TOKEN');
});

test('authentication attaches the verified user and token-scoped client', async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } };
  const middleware = createRequireAuth({
    createClient: () => supabase,
    projectUrl: 'https://example.supabase.co'
  });
  const req = request({ authorization: 'Bearer valid-token' });
  let forwarded;

  await middleware(req, responseRecorder(), (error) => { forwarded = error; });

  assert.equal(forwarded, undefined);
  assert.equal(req.user.id, 'user-1');
  assert.equal(req.accessToken, 'valid-token');
  assert.equal(req.supabase, supabase);
});

test('business authorization blocks users without an allowed active role', async () => {
  const query = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({
      data: { business_id: '9f26044b-016f-4c45-bbdf-95f6cf60ec02', role: 'cashier', status: 'active' },
      error: null
    })
  };
  const middleware = requireBusinessRoles('admin', 'manager');
  const req = {
    params: { businessId: '9f26044b-016f-4c45-bbdf-95f6cf60ec02' },
    user: { id: 'user-1' },
    supabase: { from: () => query }
  };
  let forwarded;

  await middleware(req, responseRecorder(), (error) => { forwarded = error; });

  assert.equal(forwarded.status, 403);
  assert.equal(forwarded.code, 'FORBIDDEN');
});

test('business authorization rejects malformed business IDs before querying data', async () => {
  const middleware = requireBusinessRoles('admin');
  const req = {
    params: { businessId: 'not-a-uuid' },
    user: { id: 'user-1' },
    supabase: {
      from() {
        throw new Error('database must not be queried for an invalid ID');
      }
    }
  };
  let forwarded;

  await middleware(req, responseRecorder(), (error) => { forwarded = error; });

  assert.equal(forwarded.status, 400);
  assert.equal(forwarded.code, 'INVALID_BUSINESS_ID');
});

test('business authorization attaches an active allowed membership', async () => {
  const businessId = '9f26044b-016f-4c45-bbdf-95f6cf60ec02';
  const query = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({
      data: { business_id: businessId, role: 'manager', status: 'active' },
      error: null
    })
  };
  const middleware = requireBusinessRoles('admin', 'manager');
  const req = {
    params: { businessId },
    user: { id: 'user-1' },
    supabase: { from: () => query }
  };
  let forwarded;

  await middleware(req, responseRecorder(), (error) => { forwarded = error; });

  assert.equal(forwarded, undefined);
  assert.deepEqual(req.business, { id: businessId, role: 'manager' });
});
