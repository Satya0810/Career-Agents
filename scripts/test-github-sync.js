import assert from 'assert';
import { syncPortfolioToGithub } from '../packages/github/api-client.js';

console.log('=== STARTING GITHUB PORTFOLIO SYNC TESTS ===');

const realFetch = globalThis.fetch;

// Minimal stand-in for the GitHub REST API. Records every request and answers like GitHub does
// for the repository lookup, repository creation and contents endpoints used by the sync.
function stubGithub({ repo = { default_branch: 'main' }, lookupError, created, createError }) {
  const calls = [];
  let exists = Boolean(repo);
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: `HTTP ${status}`, json: async () => body });

  globalThis.fetch = async (url, options = {}) => {
    const { pathname, searchParams } = new URL(url);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, pathname, ref: searchParams.get('ref'), branch: body?.branch });

    // Credential and permission errors apply to every request made with the same token.
    if (lookupError) return reply(lookupError.status, lookupError.body);
    if (pathname === '/repos/octo/career-portfolio' && method === 'GET') {
      return exists ? reply(200, { name: 'career-portfolio', ...repo }) : reply(404, { message: 'Not Found' });
    }
    if (pathname === '/user/repos' && method === 'POST') {
      if (createError) return reply(createError.status, createError.body);
      exists = true;
      return reply(201, { name: body.name, full_name: `octo/${body.name}`, html_url: `https://github.com/octo/${body.name}`, clone_url: '', ...created });
    }
    if (pathname.startsWith('/repos/octo/career-portfolio/contents/')) {
      if (!exists) return reply(404, { message: 'Not Found' });
      if (method === 'GET') return reply(404, { message: 'Not Found' });
      if (method === 'PUT') return reply(201, { commit: { sha: 'abc123' }, content: { html_url: `https://github.com/octo/career-portfolio/blob/${body.branch}/${pathname.split('/').pop()}` } });
    }
    return reply(404, { message: 'Not Found' });
  };
  return calls;
}

const files = { resumeMarkdown: '# Resume', coverLetterMarkdown: '# Cover Letter', projectMarkdown: '# Projects' };
const sync = () => syncPortfolioToGithub({ owner: 'octo', repo: 'career-portfolio', token: 'test-token', ...files });
const contentCalls = calls => calls.filter(c => c.pathname.includes('/contents/'));
const branchesUsed = calls => contentCalls(calls).map(c => c.method === 'GET' ? `GET ${c.ref}` : `PUT ${c.branch}`);

async function testExistingRepositoryBranch(defaultBranch) {
  console.log(`Testing sync to an existing repository whose default branch is ${defaultBranch}...`);
  const calls = stubGithub({ repo: { default_branch: defaultBranch } });
  const result = await sync();

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.pushedCount, 3);
  assert.deepStrictEqual(branchesUsed(calls), Array(3).fill([`GET ${defaultBranch}`, `PUT ${defaultBranch}`]).flat(),
    `every content lookup and write targets ${defaultBranch}`);
  assert.ok(!calls.some(c => c.method === 'POST'), 'an existing repository is not created again');
  console.log(`[PASS] Files are synced to ${defaultBranch}.`);
}

async function testCreatedRepositoryBranch() {
  console.log('Testing sync to a newly created repository whose default branch is master...');
  const calls = stubGithub({ repo: null, created: { default_branch: 'master' } });
  const result = await sync();

  assert.strictEqual(result.success, true);
  assert.ok(calls.some(c => c.method === 'POST' && c.pathname === '/user/repos'), 'the missing repository is created');
  assert.deepStrictEqual(branchesUsed(calls), Array(3).fill(['GET master', 'PUT master']).flat(),
    'files are synced to the branch reported for the new repository');
  console.log('[PASS] A newly created repository is synced to its own default branch.');
}

async function testCreationFailure() {
  console.log('Testing that a repository creation failure is reported...');
  const calls = stubGithub({
    repo: null,
    createError: {
      status: 422,
      body: { message: 'Repository creation failed.', errors: [{ resource: 'Repository', code: 'custom', field: 'name', message: 'name already exists on this account' }] }
    }
  });

  await assert.rejects(sync(), err => {
    assert.strictEqual(err.message, 'Failed to create repository career-portfolio (422): Repository creation failed.');
    return true;
  }, 'the creation error reaches the caller, not a later file error');
  assert.deepStrictEqual(contentCalls(calls), [], 'no file is read or written after creation fails');
  console.log('[PASS] Creation errors stop the sync with the original GitHub message.');
}

async function testLookupFailure(status, message) {
  console.log(`Testing that a repository lookup failure (${status}) is reported...`);
  const calls = stubGithub({ lookupError: { status, body: { message } } });

  await assert.rejects(sync(), err => {
    assert.strictEqual(err.message, `Failed to look up repository octo/career-portfolio (${status}): ${message}`);
    return true;
  }, 'the lookup error reaches the caller');
  assert.ok(!calls.some(c => c.method === 'POST'), 'no repository is created after a failed lookup');
  assert.deepStrictEqual(contentCalls(calls), [], 'no file is read or written after a failed lookup');
  console.log(`[PASS] Lookup error ${status} stops the sync with the original GitHub message.`);
}

try {
  await testExistingRepositoryBranch('main');
  await testExistingRepositoryBranch('develop');
  await testExistingRepositoryBranch('master');
  await testCreatedRepositoryBranch();
  await testCreationFailure();
  await testLookupFailure(401, 'Bad credentials');
  await testLookupFailure(403, 'Resource not accessible by personal access token');
  console.log('=== ALL GITHUB PORTFOLIO SYNC TESTS PASSED ===');
} finally {
  globalThis.fetch = realFetch;
}
