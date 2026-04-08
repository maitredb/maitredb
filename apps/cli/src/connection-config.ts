import { ConfigManager, MaitreError, MaitreErrorCode } from '@maitredb/core';
import type { Credential } from '@maitredb/core';
import type { ConnectionConfig } from '@maitredb/plugin-api';
import { parseDsn } from './dsn.js';

/**
 * Resolve a connection definition to a runtime-ready config by merging:
 * 1. saved connection metadata, and
 * 2. secure credentials from the credential manager.
 *
 * DSN credentials are parsed and expanded into regular connection fields.
 */
export async function resolveConnectionConfig(
  configManager: ConfigManager,
  connectionName: string,
): Promise<ConnectionConfig> {
  let savedConfig: ConnectionConfig | undefined;
  let missingConnectionError: MaitreError | undefined;

  try {
    savedConfig = configManager.getConnection(connectionName);
  } catch (error) {
    if (error instanceof MaitreError && error.code === MaitreErrorCode.CONNECTION_FAILED) {
      missingConnectionError = error;
    } else {
      throw error;
    }
  }

  const credential = await configManager.getCredential(connectionName);

  // DSN-only connections are valid even when there is no saved connections.json entry.
  if (!savedConfig) {
    if (credential?.kind === 'dsn') {
      const parsed = parseDsn(connectionName, credential.dsn);
      const config = cloneConfig(parsed.config);
      if (parsed.password) {
        config.password = parsed.password;
      }
      return config;
    }

    if (missingConnectionError) {
      throw missingConnectionError;
    }

    throw new MaitreError(
      MaitreErrorCode.CONNECTION_FAILED,
      `Connection "${connectionName}" not found`,
    );
  }

  let resolved = cloneConfig(savedConfig);

  if (credential?.kind === 'dsn') {
    const parsed = parseDsn(connectionName, credential.dsn);
    resolved = mergeConnectionConfigs(resolved, parsed.config);
    if (parsed.password) {
      resolved.password = parsed.password;
    }
    return resolved;
  }

  if (credential) {
    resolved = applyCredentialToConfig(resolved, credential);
  }

  return resolved;
}

function cloneConfig(config: ConnectionConfig): ConnectionConfig {
  return {
    ...config,
    auth: config.auth ? [...config.auth] : undefined,
    tags: config.tags ? [...config.tags] : undefined,
    pool: config.pool ? { ...config.pool } : undefined,
    options: config.options ? { ...(config.options as Record<string, unknown>) } : undefined,
  };
}

function mergeConnectionConfigs(base: ConnectionConfig, override: ConnectionConfig): ConnectionConfig {
  const mergedOptions = {
    ...((base.options ?? {}) as Record<string, unknown>),
    ...((override.options ?? {}) as Record<string, unknown>),
  };

  return {
    ...base,
    ...override,
    options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined,
    auth: override.auth ?? base.auth,
    tags: override.tags ?? base.tags,
    pool: {
      ...(base.pool ?? {}),
      ...(override.pool ?? {}),
    },
  };
}

function applyCredentialToConfig(config: ConnectionConfig, credential: Credential): ConnectionConfig {
  switch (credential.kind) {
    case 'password':
      return {
        ...config,
        password: credential.password,
      };

    case 'token':
      return {
        ...config,
        options: {
          ...((config.options ?? {}) as Record<string, unknown>),
          accessToken: credential.accessToken,
          refreshToken: credential.refreshToken,
          expiresAt: credential.expiresAt,
          refreshExpiresAt: credential.refreshExpiresAt,
        },
      };

    case 'key-pair':
      return {
        ...config,
        options: {
          ...((config.options ?? {}) as Record<string, unknown>),
          privateKeyPath: credential.privateKeyPath,
          privateKeyPassphrase: credential.passphrase,
        },
      };

    case 'service-account':
      return {
        ...config,
        options: {
          ...((config.options ?? {}) as Record<string, unknown>),
          keyFilePath: credential.keyFilePath,
        },
      };

    case 'iam':
      return {
        ...config,
        options: {
          ...((config.options ?? {}) as Record<string, unknown>),
          awsProfile: credential.profile,
          roleArn: credential.roleArn,
        },
      };

    case 'dsn':
      return config;
  }
}
