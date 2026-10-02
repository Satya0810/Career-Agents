import assert from 'assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolvePython } from './resolve-python.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const python = resolvePython();
if (!python) throw new Error('A Python 3 interpreter is required to run these tests');

console.log('=== STARTING REGISTRY VALIDATION TESTS ===');

// validate.py checks the whole repository relative to its own location, so run it on a copy.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-validation-'));
const skip = new Set(['.git', 'node_modules', 'apps', 'exports', '.next']);
fs.cpSync(root, workDir, { recursive: true, filter: src => !skip.has(path.basename(src)) });

const registryPath = path.join(workDir, 'agent-registry.json');
const divisionsPath = path.join(workDir, 'divisions.json');
const originalRegistry = fs.readFileSync(registryPath, 'utf8');
const originalDivisions = fs.readFileSync(divisionsPath, 'utf8');

function runValidator(mutate) {
  const registry = JSON.parse(originalRegistry);
  const divisions = JSON.parse(originalDivisions);
  mutate(registry, divisions);
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  fs.writeFileSync(divisionsPath, JSON.stringify(divisions, null, 2));
  const res = spawnSync(python, [path.join(workDir, 'scripts', 'validate.py')], { encoding: 'utf8' });
  return { status: res.status, output: `${res.stdout}${res.stderr}` };
}

const agentId = 'ats-resume-reviewer';
const registryAgent = registry => registry.agents.find(a => a.id === agentId);
const divisionOf = (divisions, name) => divisions.divisions.find(d => d.division === name);

const cases = [
  {
    name: 'duplicate agent id in agent-registry.json',
    mutate: registry => registry.agents.push({ ...registryAgent(registry) }),
    message: `Duplicate agent IDs in agent-registry.json: ['${agentId}']`
  },
  {
    name: 'agent listed twice in one division',
    mutate: (registry, divisions) => {
      const career = divisionOf(divisions, 'career');
      career.agents.push({ ...career.agents.find(a => a.id === agentId) });
    },
    message: `Agents listed more than once in divisions.json: ['${agentId}']`
  },
  {
    name: 'agent listed in two divisions',
    mutate: (registry, divisions) => {
      const entry = divisionOf(divisions, 'career').agents.find(a => a.id === agentId);
      divisionOf(divisions, 'resume').agents.push({ ...entry });
    },
    message: `Agents listed more than once in divisions.json: ['${agentId}']`
  },
  {
    name: 'agent in divisions.json but missing from agent-registry.json',
    // performance-review-advisor is not referenced by any workflow, path, company or bundle.
    mutate: registry => { registry.agents = registry.agents.filter(a => a.id !== 'performance-review-advisor'); },
    message: "Agents in divisions.json but not in agent-registry.json: ['performance-review-advisor']"
  },
  {
    name: 'agent in agent-registry.json but missing from divisions.json',
    mutate: registry => registry.agents.push({ ...registryAgent(registry), id: 'unlisted-agent' }),
    message: "Agents in agent-registry.json but not in divisions.json: ['unlisted-agent']"
  },
  {
    name: 'registry division disagrees with divisions.json',
    mutate: registry => { registryAgent(registry).division = 'cloud'; },
    message: `Agent division in agent-registry.json does not match divisions.json: ['${agentId} (registry: cloud, divisions.json: career)']`
  },
  {
    name: 'registry filename differs from divisions.json',
    mutate: registry => { registryAgent(registry).filename = 'career/career-accountability-coach.md'; },
    message: `Agent filename in agent-registry.json does not match divisions.json: ['${agentId} (registry: career/career-accountability-coach.md, divisions.json: career/${agentId}.md)']`
  },
  {
    name: 'registry filename points to a missing file',
    mutate: registry => { registryAgent(registry).filename = 'career/missing-agent.md'; },
    message: `Agent files listed in agent-registry.json do not exist: ['career/missing-agent.md']`
  }
];

try {
  console.log('Testing that the current registry and divisions pass validation...');
  const clean = runValidator(() => {});
  assert.strictEqual(clean.status, 0, clean.output);
  assert.ok(clean.output.includes('Validation passed.'), clean.output);
  console.log('[PASS] Current data passes validation.');

  for (const { name, mutate, message } of cases) {
    console.log(`Testing that validation rejects: ${name}...`);
    const res = runValidator(mutate);
    assert.notStrictEqual(res.status, 0, `validation should fail for: ${name}`);
    assert.ok(res.output.includes(message), `expected "${message}" in:\n${res.output}`);
    console.log(`[PASS] Rejected: ${name}.`);
  }
  console.log('=== ALL REGISTRY VALIDATION TESTS PASSED ===');
} finally {
  fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
