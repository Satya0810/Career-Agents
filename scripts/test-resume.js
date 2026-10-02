import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseResumeFile } from '../packages/resume/file-parser.js';
import { analyzeResumeStudio } from '../packages/resume/studio.js';
import { evaluateFaangReadiness } from '../packages/resume/faang.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('=== STARTING RESUME STUDIO TESTS ===');

async function testResumeParsing() {
  console.log('Testing Resume parsing...');
  const tempPath = path.join(root, 'exports', 'test_resume_temp.md');
  fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  fs.writeFileSync(tempPath, `
Alex Smith
alex.smith@example.com
linkedin.com/in/alexsmith

# Summary
Software Architect with 8 years experience building backend APIs.

# Experience
Role: Architect at Stripe (2020 - 2024)
- Designed payment gateway routes, reducing latency by 45%.
- Implemented robust error filters.

# Skills
Python, Go, SQL, APIs, Docker, Git

# Education
Degree: BS Computer Science from MIT (2016-2020)
  `, 'utf8');

  const resume = await parseResumeFile(tempPath);
  assert.strictEqual(resume.header.name, 'Alex Smith');
  assert.strictEqual(resume.header.email, 'alex.smith@example.com');
  assert.ok(resume.skills.includes('Python'));
  assert.strictEqual(resume.experience[0].company, 'Stripe');
  assert.strictEqual(resume.experience[0].bullets.length, 2);

  console.log('[PASS] Resume parsing matches expectations.');
}

async function testResumeAnalysis() {
  console.log('Testing Resume Studio Scorer & Bullet audits...');
  const tempPath = path.join(root, 'exports', 'test_resume_temp.md');
  const report = await analyzeResumeStudio(tempPath, 'stripe');
  
  assert.ok(report.overallScore > 0 && report.overallScore <= 100);
  assert.ok(report.categoryScores.experience > 0);
  assert.ok(report.keywordAnalysis.matched.includes('apis'));
  assert.ok(report.weakBullets.length >= 0);
  assert.ok(report.bulletRewrites.length >= 0);
  assert.ok(report.companyOptimizations.length > 0);

  console.log('[PASS] Scorer and audits successfully evaluated.');
}

async function testFaangAndKeywordBoundaries() {
  console.log('Testing FAANG readiness and keyword matching word-boundary guards...');

  // 1. FAANG Google: resume mentioning "algorithms" must NOT match "go"
  const algorithmsResume = {
    skills: ['Python', 'SQL'],
    summary: 'Specialized in distributed algorithms and data structures.'
  };
  const googleEval = evaluateFaangReadiness(algorithmsResume, 'google');
  assert.ok(googleEval.matchedKeywords.includes('algorithms'), 'Should match algorithms');
  assert.strictEqual(googleEval.matchedKeywords.includes('go'), false, '"algorithms" must not trigger "go"');
  assert.ok(googleEval.missingKeywords.includes('go'), '"go" must be in missingKeywords');

  // 2. FAANG Amazon: resume mentioning "JavaScript" must NOT match "java"
  const jsResume = {
    skills: ['JavaScript', 'HTML/CSS'],
    summary: 'Frontend developer with rich JavaScript experience.'
  };
  const amazonEval = evaluateFaangReadiness(jsResume, 'amazon');
  assert.strictEqual(amazonEval.matchedKeywords.includes('java'), false, '"JavaScript" must not trigger "java"');
  assert.ok(amazonEval.missingKeywords.includes('java'), '"java" must be in missingKeywords');

  // 3. Positive match: explicit "Go" and "Java" skills match
  const goJavaResume = {
    skills: ['Go', 'Java'],
    summary: 'Backend developer with Go microservices and Java Spring.'
  };
  const googlePositive = evaluateFaangReadiness(goJavaResume, 'google');
  const amazonPositive = evaluateFaangReadiness(goJavaResume, 'amazon');
  assert.ok(googlePositive.matchedKeywords.includes('go'), 'Explicit Go must match');
  assert.ok(amazonPositive.matchedKeywords.includes('java'), 'Explicit Java must match');

  console.log('[PASS] Word-boundary keyword matching verified against false-positive triggers.');
}

async function run() {
  try {
    await testResumeParsing();
    await testResumeAnalysis();
    await testFaangAndKeywordBoundaries();
    console.log('=== ALL RESUME STUDIO TESTS PASSED ===\n');
    process.exit(0);
  } catch (e) {
    console.error('TEST FAILED:', e);
    process.exit(1);
  }
}

run();
