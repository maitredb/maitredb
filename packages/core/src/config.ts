import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { ConnectionConfig } from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from './errors.js';
import { CredentialManager } from './credentials.js';
import type { Credential, CredentialManagerOptions } from './credentials.js';

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

/** Resolves Maître d'B configuration, connections, and credentials. */
export class ConfigManager {
  private userDir: string;
  private projectDir: string | undefined;
  private _credentialManager: CredentialManager | undefined;
  private credentialOpts: CredentialManagerOptions | undefined;

  constructor(options?: { credentialManager?: CredentialManagerOptions }) {
    this.userDir = userConfigDir();
    this.projectDir = projectConfigDir();
    this.credentialOpts = options?.credentialManager;
  }

  /** Lazy-initialized credential manager. */
  get credentials(): CredentialManager {
    if (!this._credentialManager) {
      this._credentialManager = new CredentialManager(this.credentialOpts);
    }
    return this._credentialManager;
  }

  /** Load the merged config using the precedence described in the architecture spec. */
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

  /** Return every saved connection from both user + project config scopes. */
  getConnections(): Record<string, ConnectionConfig> {
    const userConns = this.loadConnections(join(this.userDir, 'connections.json'));
    const projectConns = this.projectDir
      ? this.loadConnections(join(this.projectDir, 'connections.json'))
      : {};
    return { ...userConns, ...projectConns };
  }

  /** Retrieve a connection by name or raise a typed {@link MaitreError}. */
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

  /**
   * Retrieve the credential for a connection from the credential store.
   * Returns undefined if no credential is stored (e.g. embedded DBs).
   */
  async getCredential(connectionName: string): Promise<Credential | undefined> {
    return this.credentials.get(connectionName);
  }

  /**
   * Store a credential securely. Never writes secrets to connections.json.
   */
  async storeCredential(connectionName: string, credential: Credential): Promise<void> {
    return this.credentials.store(connectionName, credential);
  }

  /** Persist a connection definition to the user config directory. */
  saveConnection(name: string, config: ConnectionConfig): void {
    const dir = this.userDir;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filePath = join(dir, 'connections.json');
    const existing = this.loadConnections(filePath);
    existing[name] = { ...config, name };
    writeFileSync(filePath, JSON.stringify({ connections: existing }, null, 2) + '\n');
  }

  /** Remove a saved connection without touching stored credentials. */
  removeConnection(name: string): boolean {
    const filePath = join(this.userDir, 'connections.json');
    const existing = this.loadConnections(filePath);
    if (!(name in existing)) return false;
    delete existing[name];
    writeFileSync(filePath, JSON.stringify({ connections: existing }, null, 2) + '\n');
    return true;
  }

  /**
   * Remove a connection and its stored credentials.
   */
  async removeConnectionWithCredentials(name: string): Promise<boolean> {
    const removed = this.removeConnection(name);
    await this.credentials.delete(name);
    return removed;
  }

  private loadConnections(filePath: string): Record<string, ConnectionConfig> {
    const data = loadJsonFile<{ connections?: Record<string, ConnectionConfig> }>(filePath);
    return data?.connections ?? {};
  }
}
