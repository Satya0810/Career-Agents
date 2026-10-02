import assert from 'assert';
import { scoreKeywordMatches } from '../packages/brain/keyword-score.js';

console.log('=== STARTING KNOWLEDGE SEARCH TESTS ===');

// Same tokenization as searchKnowledgeBase() in packages/brain/knowledge.ts
const queryWords = (query) => query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
const score = (content, query) => scoreKeywordMatches(content.toLowerCase(), queryWords(query));

const resume = 'Skills: C++, C#, Python (Django), Node.js, Kubernetes. Built a low-latency C++ trading engine [2023] and a REST API for payments. Led migration of 40 services to Kubernetes.';

function testOrdinaryTermsKeepTheirScores() {
  assert.strictEqual(score(resume, 'kubernetes migration'), 6, 'two whole-word matches score 3 each');
  assert.strictEqual(score(resume, 'kube'), 1, 'a partial word only gets the substring point');
  assert.strictEqual(score(resume, 'golang rust'), 0, 'absent words score nothing');
  console.log('[PASS] Ordinary terms keep their existing scores');
}

function testRegexSyntaxIsLiteral() {
  assert.strictEqual(score(resume, 'How can I improve my C++ projects?'), 1, 'c++ is found as literal text');
  const content = 'notes: [abc (django {2023 a** ?why';
  for (const term of ['[abc', '(django', '{2023', 'a**', '?why']) {
    assert.ok(score(content, term) >= 1, `${term} should be matched literally`);
  }
  console.log('[PASS] Query words with regex syntax are matched as literal text');
}

function testMixedQuery() {
  assert.strictEqual(score(resume, 'python c++'), 4, 'python whole word (3) + c++ substring (1)');
  console.log('[PASS] A special term does not break the rest of the query');
}

function testEmptyQuery() {
  assert.strictEqual(score(resume, ''), 0);
  assert.strictEqual(score(resume, '   '), 0);
  console.log('[PASS] Empty and whitespace-only queries score nothing');
}

try {
  testOrdinaryTermsKeepTheirScores();
  testRegexSyntaxIsLiteral();
  testMixedQuery();
  testEmptyQuery();
  console.log('=== ALL KNOWLEDGE SEARCH TESTS PASSED ===\n');
  process.exit(0);
} catch (e) {
  console.error('KNOWLEDGE SEARCH TEST FAILED:', e.message);
  process.exit(1);
}
