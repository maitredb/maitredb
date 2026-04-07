import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, hostname, userInfo } from 'node:os';
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { MaitreError, MaitreErrorCode } from './errors.js';

// ---------------------------------------------------------------------------
// Credential types — covers all auth methods across all planned drivers
// ---------------------------------------------------------------------------

/** Simple username/password auth (Postgres, MySQL, etc.) */
export interface PasswordCredential {
  readonly kind: 'password';
  readonly password: string;
}

/** Private-key auth (Snowflake key-pair, PG certificate, SSH tunnel) */
export interface KeyPairCredential {
  readonly kind: 'key-pair';
  readonly privateKeyPath: string;
  readonly passphrase?: string;
}

/** OAuth / SSO token with optional refresh (Snowflake SSO, BigQuery, etc.) */
export interface TokenCredential {
  readonly kind: 'token';
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** ISO-8601 expiry time for the access token */
  readonly expiresAt?: string;
  /** ISO-8601 expiry time for the refresh token */
  readonly refreshExpiresAt?: string;
}

/** Service-account key file (BigQuery, GCP ADC) */
export interface ServiceAccountCredential {
  readonly kind: 'service-account';
  readonly keyFilePath: string;
}

/** IAM-based auth — no stored secret, resolved at runtime (AWS IAM, GCP ADC) */
export interface IamCredential {
  readonly kind: 'iam';
  readonly profile?: string; // e.g. AWS profile name
  readonly roleArn?: string;
}

/** Full DSN string (contains embedded credentials) */
export interface DsnCredential {
  readonly kind: 'dsn';
  readonly dsn: string;
}

export type Credential =
  | PasswordCredential
  | KeyPairCredential
  | TokenCredential
  | ServiceAccountCredential
  | IamCredential
  | DsnCredential;

// ---------------------------------------------------------------------------
// CredentialBackend — pluggable storage interface
// ---------------------------------------------------------------------------

export interface CredentialBackend {
  readonly name: string;

  /** Return true if this backend is available in the current environment. */
  isAvailable(): Promise<boolean>;

  /** Retrieve a credential by connection name. Returns undefined if not found. */
  get(connectionName: string): Promise<Credential | undefined>;

  /** Store a credential for a connection. Not all backends support writes. */
  store(connectionName: string, credential: Credential): Promise<void>;

  /** Delete a credential. Returns true if it existed. */
  delete(connectionName: string): Promise<boolean>;

  /** List all connection names that have stored credentials. */
  list(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// EnvironmentCredentialBackend
// ---------------------------------------------------------------------------

/**
 * Reads credentials from environment variables.
 *
 * Supported patterns:
 *   MDB_CONN_<NAME>_PASSWORD  → PasswordCredential
 *   MDB_CONN_<NAME>_DSN       → DsnCredential
 *   MDB_CONN_<NAME>_TOKEN     → TokenCredential
 *   MDB_CONN_<NAME>_KEY_FILE  → ServiceAccountCredential
 *
 * Connection name is upper-cased and hyphens become underscores.
 */
export class EnvironmentCredentialBackend implements CredentialBackend {
  readonly name = 'environment';

  async isAvailable(): Promise<boolean> {
    return true; // always available
  }

  async get(connectionName: string): Promise<Credential | undefined> {
    const prefix = this.envPrefix(connectionName);

    const dsn = process.env[`${prefix}_DSN`];
    if (dsn) return { kind: 'dsn', dsn };

    const password = process.env[`${prefix}_PASSWORD`];
    if (password) return { kind: 'password', password };

    const token = process.env[`${prefix}_TOKEN`];
    if (token) return { kind: 'token', accessToken: token };

    const keyFile = process.env[`${prefix}_KEY_FILE`];
    if (keyFile) return { kind: 'service-account', keyFilePath: keyFile };

    return undefined;
  }

  async store(_connectionName: string, _credential: Credential): Promise<void> {
    throw new MaitreError(
      MaitreErrorCode.CONFIG_ERROR,
      'Cannot write credentials to environment variables. Set them in your shell profile or CI configuration.',
    );
  }

  async delete(_connectionName: string): Promise<boolean> {
    return false; // env vars can't be deleted from here
  }

  async list(): Promise<string[]> {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const key of Object.keys(process.env)) {
      const match = /^MDB_CONN_(.+?)_(PASSWORD|DSN|TOKEN|KEY_FILE)$/.exec(key);
      if (match) {
        const name = match[1]!.toLowerCase().replace(/_/g, '-');
        if (!seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
    }
    return names;
  }

  private envPrefix(connectionName: string): string {
    return `MDB_CONN_${connectionName.toUpperCase().replace(/-/g, '_')}`;
  }
}

// ---------------------------------------------------------------------------
// KeychainCredentialBackend
// ---------------------------------------------------------------------------

const KEYCHAIN_SERVICE = 'maitredb';

/**
 * Uses the system keychain via `keytar` (optional dependency).
 * Falls back gracefully if keytar is not installed.
 */
export class KeychainCredentialBackend implements CredentialBackend {
  readonly name = 'keychain';
  private keytar: KeytarModule | null | undefined = undefined; // undefined = not yet checked

  async isAvailable(): Promise<boolean> {
    return (await this.loadKeytar()) !== null;
  }

  async get(connectionName: string): Promise<Credential | undefined> {
    const kt = await this.loadKeytar();
    if (!kt) return undefined;

    const raw = await kt.getPassword(KEYCHAIN_SERVICE, connectionName);
    if (!raw) return undefined;

    try {
      return JSON.parse(raw) as Credential;
    } catch {
      // Legacy plain-text password stored directly
      return { kind: 'password', password: raw };
    }
  }

  async store(connectionName: string, credential: Credential): Promise<void> {
    const kt = await this.loadKeytar();
    if (!kt) {
      throw new MaitreError(
        MaitreErrorCode.CONFIG_ERROR,
        'System keychain is not available. Install keytar or use the encrypted file backend.',
        undefined,
        undefined,
        'Run "npm install keytar" or use --master-password to enable the encrypted file backend.',
      );
    }
    await kt.setPassword(KEYCHAIN_SERVICE, connectionName, JSON.stringify(credential));
  }

  async delete(connectionName: string): Promise<boolean> {
    const kt = await this.loadKeytar();
    if (!kt) return false;
    return kt.deletePassword(KEYCHAIN_SERVICE, connectionName);
  }

  async list(): Promise<string[]> {
    const kt = await this.loadKeytar();
    if (!kt) return [];
    const entries = await kt.findCredentials(KEYCHAIN_SERVICE);
    return entries.map((e: { account: string }) => e.account);
  }

  private async loadKeytar(): Promise<KeytarModule | null> {
    if (this.keytar !== undefined) return this.keytar;
    try {
      // Dynamic import — keytar is an optional dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.keytar = (await (Function('return import("keytar")')() as Promise<unknown>)) as KeytarModule;
      return this.keytar;
    } catch {
      this.keytar = null;
      return null;
    }
  }
}

interface KeytarModule {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findCredentials(service: string): Promise<Array<{ account: string; password: string }>>;
}

// ---------------------------------------------------------------------------
// EncryptedFileCredentialBackend
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 recommendation for SHA-256
const PBKDF2_DIGEST = 'sha256';
const FILE_VERSION = 1;

interface CredentialFileEnvelope {
  version: number;
  salt: string; // hex
  credentials: Record<string, EncryptedEntry>;
}

interface EncryptedEntry {
  iv: string;     // hex
  tag: string;    // hex
  data: string;   // hex — encrypted JSON
}

/**
 * AES-256-GCM encrypted file at `~/.maitredb/credentials.enc`.
 *
 * Encryption key is derived via PBKDF2 from:
 *   - Machine fingerprint (hostname + username) — not a secret, prevents portability of stolen files
 *   - Optional master password — for environments that need stronger protection
 *
 * The salt is stored in the envelope (per-file, generated once).
 * Each credential entry has its own IV for independent updates.
 */
export class EncryptedFileCredentialBackend implements CredentialBackend {
  readonly name = 'encrypted-file';
  private filePath: string;
  private masterPassword: string;

  constructor(options?: { filePath?: string; masterPassword?: string }) {
    this.filePath = options?.filePath ?? join(homedir(), '.maitredb', 'credentials.enc');
    this.masterPassword = options?.masterPassword ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return true; // always available as the pure-JS fallback
  }

  async get(connectionName: string): Promise<Credential | undefined> {
    const envelope = this.readEnvelope();
    if (!envelope) return undefined;

    const entry = envelope.credentials[connectionName];
    if (!entry) return undefined;

    return this.decryptEntry(entry, envelope.salt);
  }

  async store(connectionName: string, credential: Credential): Promise<void> {
    let envelope = this.readEnvelope();
    if (!envelope) {
      envelope = {
        version: FILE_VERSION,
        salt: randomBytes(SALT_LENGTH).toString('hex'),
        credentials: {},
      };
    }

    envelope.credentials[connectionName] = this.encryptEntry(credential, envelope.salt);
    this.writeEnvelope(envelope);
  }

  async delete(connectionName: string): Promise<boolean> {
    const envelope = this.readEnvelope();
    if (!envelope || !(connectionName in envelope.credentials)) return false;

    delete envelope.credentials[connectionName];
    this.writeEnvelope(envelope);
    return true;
  }

  async list(): Promise<string[]> {
    const envelope = this.readEnvelope();
    return envelope ? Object.keys(envelope.credentials) : [];
  }

  // --- crypto helpers ---

  private deriveKey(salt: string): Buffer {
    const passphrase = this.machineFingerprint() + ':' + this.masterPassword;
    return pbkdf2Sync(passphrase, Buffer.from(salt, 'hex'), PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
  }

  private machineFingerprint(): string {
    // Not a secret — just makes the encrypted file non-portable
    try {
      return `${hostname()}:${userInfo().username}`;
    } catch {
      return `${hostname()}:unknown`;
    }
  }

  private encryptEntry(credential: Credential, salt: string): EncryptedEntry {
    const key = this.deriveKey(salt);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const plaintext = JSON.stringify(credential);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  private decryptEntry(entry: EncryptedEntry, salt: string): Credential {
    const key = this.deriveKey(salt);
    const iv = Buffer.from(entry.iv, 'hex');
    const tag = Buffer.from(entry.tag, 'hex');
    const data = Buffer.from(entry.data, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);

    try {
      const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      return JSON.parse(plaintext) as Credential;
    } catch {
      throw new MaitreError(
        MaitreErrorCode.AUTHENTICATION_FAILED,
        'Failed to decrypt credentials. Wrong master password or corrupted credential file.',
        undefined,
        undefined,
        'Try again with the correct master password, or delete ~/.maitredb/credentials.enc to reset.',
      );
    }
  }

  // --- file I/O ---

  private readEnvelope(): CredentialFileEnvelope | undefined {
    if (!existsSync(this.filePath)) return undefined;
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw) as CredentialFileEnvelope;
    } catch {
      return undefined;
    }
  }

  private writeEnvelope(envelope: CredentialFileEnvelope): void {
    const dir = join(this.filePath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(envelope, null, 2) + '\n', { mode: 0o600 });
  }
}

// ---------------------------------------------------------------------------
// CredentialManager — resolution chain
// ---------------------------------------------------------------------------

export interface CredentialManagerOptions {
  /** Override the default backend chain. */
  backends?: CredentialBackend[];
  /** Master password for the encrypted file backend. */
  masterPassword?: string;
  /** Path to a mounted secrets file (Kubernetes / Docker). */
  credentialsFile?: string;
}

/**
 * Resolves credentials by walking a chain of backends in priority order:
 *   1. Environment variables (fastest, no I/O)
 *   2. Mounted secrets file (if configured)
 *   3. System keychain (if keytar available)
 *   4. Encrypted file (always available, pure-JS fallback)
 *
 * Writes go to the first writable backend (keychain if available, else encrypted file).
 */
export class CredentialManager {
  private backends: CredentialBackend[];

  constructor(options?: CredentialManagerOptions) {
    if (options?.backends) {
      this.backends = options.backends;
    } else {
      this.backends = [
        new EnvironmentCredentialBackend(),
        new KeychainCredentialBackend(),
        new EncryptedFileCredentialBackend({
          masterPassword: options?.masterPassword,
          filePath: options?.credentialsFile,
        }),
      ];
    }
  }

  /**
   * Resolve a credential for a connection by walking the backend chain.
   * Returns undefined if no credential is found in any backend.
   */
  async get(connectionName: string): Promise<Credential | undefined> {
    for (const backend of this.backends) {
      if (!(await backend.isAvailable())) continue;
      const cred = await backend.get(connectionName);
      if (cred) return cred;
    }
    return undefined;
  }

  /**
   * Store a credential. Writes to the first available writable backend
   * (skips environment, which is read-only).
   */
  async store(connectionName: string, credential: Credential): Promise<void> {
    for (const backend of this.backends) {
      if (!(await backend.isAvailable())) continue;
      try {
        await backend.store(connectionName, credential);
        return;
      } catch (err) {
        // If this backend can't write (e.g. env), try the next one
        if (err instanceof MaitreError && err.code === MaitreErrorCode.CONFIG_ERROR) {
          continue;
        }
        throw err;
      }
    }
    throw new MaitreError(
      MaitreErrorCode.CONFIG_ERROR,
      'No writable credential backend available.',
      undefined,
      undefined,
      'Ensure keytar is installed or that the encrypted file backend is accessible.',
    );
  }

  /**
   * Delete a credential from all backends where it exists.
   * Returns true if it was deleted from at least one backend.
   */
  async delete(connectionName: string): Promise<boolean> {
    let deleted = false;
    for (const backend of this.backends) {
      if (!(await backend.isAvailable())) continue;
      try {
        if (await backend.delete(connectionName)) deleted = true;
      } catch {
        // best-effort deletion across backends
      }
    }
    return deleted;
  }

  /**
   * List all connection names that have credentials in any backend.
   */
  async list(): Promise<string[]> {
    const seen = new Set<string>();
    for (const backend of this.backends) {
      if (!(await backend.isAvailable())) continue;
      for (const name of await backend.list()) {
        seen.add(name);
      }
    }
    return [...seen];
  }

  /**
   * Get the name of the backend that holds a given credential.
   * Useful for `mdb connect list` to show where credentials are stored.
   */
  async locateBackend(connectionName: string): Promise<string | undefined> {
    for (const backend of this.backends) {
      if (!(await backend.isAvailable())) continue;
      const cred = await backend.get(connectionName);
      if (cred) return backend.name;
    }
    return undefined;
  }
}
