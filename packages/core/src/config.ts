import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { ConnectionConfig } from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from './errors.js';

export interface MaitreConfig {
  defaultFormat: 'table' | 'json' | 'csv' | 'ndjson' | 'yaml' | 'raw';
  defaultConnection?: string;
  maxRows: number;
}

const DEFAULTS: MaitreConfig = {
  defaultFormat: 'table',
  maxRows: 10000,
};

function userConfigDir(): string {
  return join(homedir(), '.maitredb');
}

function projectConfigDir(): string | undefined {
  let dir = process.cwd();
  const root = resolve('/');
  while (dir !== root) {
    const candidate = join(dir, '.maitredb');
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, '..');
  }
  return undefined;
}

function loadJsonFile<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

export class ConfigManager {
  private userDir: string;
  private projectDir: string | undefined;

  constructor() {
    this.userDir = userConfigDir();
    this.projectDir = projectConfigDir();
  }

  getConfig(overrides?: Partial<MaitreConfig>): MaitreConfig {
    const userConfig = loadJsonFile<Partial<MaitreConfig>>(join(this.userDir, 'config.json'));
    const projectConfig = this.projectDir
      ? loadJsonFile<Partial<MaitreConfig>>(join(this.projectDir, 'config.json'))
      : undefined;

    // env var overrides
    const envOverrides: Partial<MaitreConfig> = {};
    if (process.env['MDB_DEFAULT_FORMAT']) {
      envOverrides.defaultFormat = process.env['MDB_DEFAULT_FORMAT'] as MaitreConfig['defaultFormat'];
    }
    if (process.env['MDB_DEFAULT_CONNECTION']) {
      envOverrides.defaultConnection = process.env['MDB_DEFAULT_CONNECTION'];
    }
    if (process.env['MDB_MAX_ROWS']) {
      envOverrides.maxRows = parseInt(process.env['MDB_MAX_ROWS'], 10);
    }

    return {
      ...DEFAULTS,
      ...userConfig,
      ...projectConfig,
      ...envOverrides,
      ...overrides,
    };
  }

  getConnections(): Record<string, ConnectionConfig> {
    const userConns = this.loadConnections(join(this.userDir, 'connections.json'));
    const projectConns = this.projectDir
      ? this.loadConnections(join(this.projectDir, 'connections.json'))
      : {};
    return { ...userConns, ...projectConns };
  }

  getConnection(name: string): ConnectionConfig {
    const all = this.getConnections();
    const conn = all[name];
    if (!conn) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        `Connection "${name}" not found`,
        undefined,
        undefined,
        `Run "mdb connect list" to see available connections, or "mdb connect add ${name}" to create one.`,
      );
    }
    return conn;
  }

  saveConnection(name: string, config: ConnectionConfig): void {
    const dir = this.userDir;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filePath = join(dir, 'connections.json');
    const existing = this.loadConnections(filePath);
    existing[name] = { ...config, name };
    writeFileSync(filePath, JSON.stringify({ connections: existing }, null, 2) + '\n');
  }

  removeConnection(name: string): boolean {
    const filePath = join(this.userDir, 'connections.json');
    const existing = this.loadConnections(filePath);
    if (!(name in existing)) return false;
    delete existing[name];
    writeFileSync(filePath, JSON.stringify({ connections: existing }, null, 2) + '\n');
    return true;
  }

  private loadConnections(filePath: string): Record<string, ConnectionConfig> {
    const data = loadJsonFile<{ connections?: Record<string, ConnectionConfig> }>(filePath);
    return data?.connections ?? {};
  }
}
