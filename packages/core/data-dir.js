/**
 * Career-Agents Core · User Data Directory
 *
 * User data (application tracker, profile, logs) must not live inside an
 * npm-installed package, because npm replaces that directory on every upgrade.
 *
 *   1. CAREER_AGENTS_HOME, when set, is always used.
 *   2. An installed package (inside node_modules) uses ~/.career-agents.
 *   3. A source checkout keeps using the repository root.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Files that earlier versions stored in the package root.
const LEGACY_DATA_FILES = ['pipeline-tracker.md', '.career-profile.json'];
const MIGRATION_MARKER = '.legacy-data-migrated';

function currentHomeDir() {
  try {
    return os.homedir();
  } catch {
    return '';
  }
}

export function resolveDataDir({ env = process.env, root = packageRoot, homeDir, pathApi = path } = {}) {
  const override = (env.CAREER_AGENTS_HOME || '').trim();
  if (override) return pathApi.resolve(override);

  const installed = root.split(/[\\/]+/).includes('node_modules');
  if (!installed) return root;

  const home = homeDir === undefined ? currentHomeDir() : homeDir;
  return home ? pathApi.join(home, '.career-agents') : root;
}

/**
 * Copies data files from the package root into a separate data directory, once.
 * Existing files are never overwritten and the originals are left in place.
 * Returns the names of the files that were copied.
 */
export function migrateLegacyData({ root = packageRoot, dataDir = resolveDataDir({ root }) } = {}) {
  if (path.resolve(dataDir) === path.resolve(root)) return [];

  fs.mkdirSync(dataDir, { recursive: true });
  const marker = path.join(dataDir, MIGRATION_MARKER);
  try {
    fs.closeSync(fs.openSync(marker, 'wx'));
  } catch (err) {
    if (err.code === 'EEXIST') return [];
    throw err;
  }

  const copied = [];
  try {
    for (const name of LEGACY_DATA_FILES) {
      try {
        fs.copyFileSync(path.join(root, name), path.join(dataDir, name), fs.constants.COPYFILE_EXCL);
        copied.push(name);
      } catch (err) {
        if (err.code !== 'ENOENT' && err.code !== 'EEXIST') throw err;
      }
    }
  } catch (err) {
    // Allow the next run to retry an interrupted migration.
    fs.rmSync(marker, { force: true });
    throw err;
  }
  return copied;
}

let preparedDataDir = null;

/** Resolves a path inside the user data directory, migrating legacy data on first use. */
export function resolveDataPath(...segments) {
  const dataDir = resolveDataDir();
  if (preparedDataDir !== dataDir) {
    preparedDataDir = dataDir;
    try {
      migrateLegacyData({ dataDir });
    } catch (err) {
      console.error(`Career-Agents: could not prepare data directory ${dataDir}: ${err.message}`);
    }
  }
  return path.join(dataDir, ...segments);
}
