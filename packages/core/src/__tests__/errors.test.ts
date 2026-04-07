import { describe, it, expect } from 'vitest';
import { MaitreError, MaitreErrorCode, exitCodeForError, EXIT_USER_ERROR, EXIT_GOVERNANCE_VIOLATION, EXIT_SYSTEM_ERROR } from '../errors.js';

describe('MaitreError', () => {
  it('creates with all fields', () => {
    const err = new MaitreError(
      MaitreErrorCode.SYNTAX_ERROR,
      'bad sql',
      'sqlite',
      'SQLITE_ERROR',
      'Check your syntax',
    );
    expect(err.code).toBe(2001);
    expect(err.message).toBe('bad sql');
    expect(err.dialect).toBe('sqlite');
    expect(err.nativeCode).toBe('SQLITE_ERROR');
    expect(err.suggestion).toBe('Check your syntax');
    expect(err.name).toBe('MaitreError');
  });

  it('serializes to JSON', () => {
    const err = new MaitreError(MaitreErrorCode.CONNECTION_FAILED, 'refused', 'postgresql');
    const json = err.toJSON();
    expect(json.error).toBe('CONNECTION_FAILED');
    expect(json.code).toBe(1001);
    expect(json.message).toBe('refused');
    expect(json.dialect).toBe('postgresql');
  });
});

describe('exitCodeForError', () => {
  it('returns governance code for 3xxx', () => {
    const err = new MaitreError(MaitreErrorCode.POLICY_VIOLATION, 'blocked');
    expect(exitCodeForError(err)).toBe(EXIT_GOVERNANCE_VIOLATION);
  });

  it('returns system code for 9xxx', () => {
    const err = new MaitreError(MaitreErrorCode.INTERNAL_ERROR, 'crash');
    expect(exitCodeForError(err)).toBe(EXIT_SYSTEM_ERROR);
  });

  it('returns user code for other errors', () => {
    const err = new MaitreError(MaitreErrorCode.SYNTAX_ERROR, 'bad sql');
    expect(exitCodeForError(err)).toBe(EXIT_USER_ERROR);
  });
});
