import fs from 'fs';
import path from 'path';
import { resolveDataPath } from '../core/data-dir.js';

const TELEMETRY_LOG = resolveDataPath('exports', 'logs', 'telemetry.log');

export function trackEvent(commandName, metadata = {}) {
  let profile = { telemetry_opt_in: false };
  
  try {
    const profilePath = resolveDataPath('.career-profile.json');
    if (fs.existsSync(profilePath)) {
      profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    }
  } catch (e) {}
  
  if (!profile.telemetry_opt_in) {
    return false;
  }

  const timestamp = new Date().toISOString();
  const event = {
    timestamp,
    command: commandName,
    cli_version: '1.4.0',
    platform: process.platform,
    arch: process.arch,
    ...metadata
  };

  try {
    fs.mkdirSync(path.dirname(TELEMETRY_LOG), { recursive: true });
    fs.appendFileSync(TELEMETRY_LOG, JSON.stringify(event) + '\n', 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}
