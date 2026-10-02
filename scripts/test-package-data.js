// Verifies that user data written by the npm-installed CLI survives a package upgrade.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmBin = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin');
const npmCli = process.platform === 'win32' ? path.join(npmBin, 'npm-cli.js') : null;
const npm = npmCli ? process.execPath : 'npm';
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'career agents package data-'));
const cacheDir = path.join(workDir, 'npm-cache');
const projectDir = path.join(workDir, 'project');
const installedDir = path.join(projectDir, 'node_modules', 'career-agents');
const installedCli = path.join(installedDir, 'scripts', 'cli.js');
const dataDir = path.join(workDir, 'career data');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.error?.message || result.stderr || result.stdout}`);
  return result;
}

function runNpm(args, options) {
  return run(npm, npmCli ? [npmCli, ...args] : args, options);
}

function careerAgents(args, env) {
  return run(process.execPath, [installedCli, ...args], { cwd: projectDir, env });
}

function install(tarball) {
  runNpm(['install', '--ignore-scripts', tarball, '--cache', cacheDir], { cwd: projectDir });
}

function exists(file) {
  try {
    fs.statSync(file);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

const baseEnv = { ...process.env, npm_config_cache: cacheDir };
delete baseEnv.CAREER_AGENTS_HOME;

try {
  console.log('[1/5] Packing and installing the current package...');
  const packed = JSON.parse(runNpm(['pack', '--json', '--pack-destination', workDir, '--cache', cacheDir], { cwd: root }).stdout);
  fs.mkdirSync(projectDir);
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({ name: 'data-package-test', private: true }));
  install(path.join(workDir, packed[0].filename));

  console.log('[2/5] Creating tracker and profile data with the installed CLI...');
  const env = { ...baseEnv, CAREER_AGENTS_HOME: dataDir };
  careerAgents(['pipeline', 'add', 'Stripe', 'Backend Engineer'], env);
  careerAgents(['dashboard'], env);
  assert.ok(fs.readFileSync(path.join(dataDir, 'pipeline-tracker.md'), 'utf8').includes('| Stripe | Backend Engineer |'));
  assert.ok(exists(path.join(dataDir, '.career-profile.json')), 'profile is stored in CAREER_AGENTS_HOME');
  assert.ok(!exists(path.join(installedDir, 'pipeline-tracker.md')), 'tracker must not be stored inside the installed package');
  assert.ok(!exists(path.join(installedDir, '.career-profile.json')), 'profile must not be stored inside the installed package');

  console.log('[3/5] Upgrading the installed package to a new version...');
  const upgradeSource = path.join(workDir, 'upgrade-source');
  fs.cpSync(installedDir, upgradeSource, { recursive: true });
  const manifestPath = path.join(upgradeSource, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const upgradedVersion = `${manifest.version}-upgrade.1`;
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: upgradedVersion }, null, 2));
  const repacked = JSON.parse(runNpm(['pack', upgradeSource, '--json', '--ignore-scripts', '--pack-destination', workDir, '--cache', cacheDir], { cwd: workDir }).stdout);
  install(path.join(workDir, repacked[0].filename));
  assert.equal(JSON.parse(fs.readFileSync(path.join(installedDir, 'package.json'), 'utf8')).version, upgradedVersion);

  console.log('[4/5] Reading the tracker with the upgraded CLI...');
  assert.ok(careerAgents(['pipeline', 'tracker'], env).stdout.includes('Stripe'), 'tracker data survives the package upgrade');
  assert.ok(exists(path.join(dataDir, '.career-profile.json')), 'profile survives the package upgrade');

  console.log('[5/5] Checking the default per-user data directory...');
  const home = path.join(workDir, 'home dir');
  fs.mkdirSync(home);
  careerAgents(['pipeline', 'add', 'Acme', 'Site Reliability Engineer'], { ...baseEnv, HOME: home, USERPROFILE: home });
  assert.ok(fs.readFileSync(path.join(home, '.career-agents', 'pipeline-tracker.md'), 'utf8').includes('| Acme |'));
  assert.ok(!exists(path.join(installedDir, 'pipeline-tracker.md')), 'default data directory is outside the installed package');

  console.log('PASS: user data is stored outside the installed package and survives an upgrade.');
} finally {
  try {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
  } catch (error) {
    console.error(`Warning: could not remove temporary test directory ${workDir}: ${error.message}`);
  }
}
