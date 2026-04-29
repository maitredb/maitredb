import { describe, expect, it } from 'vitest';
import { QueryClassifier } from '../classifier.js';

const classifier = new QueryClassifier();

describe('QueryClassifier', () => {
  it('allows semicolons inside literals without treating the query as multi-statement', () => {
    const classification = classifier.classify("SELECT ';' AS semicolon FROM public.users WHERE id = 1", 'postgresql');

    expect(classification.type).toBe('read');
    expect(classification.operation).toBe('SELECT');
    expect(classification.statementCount).toBe(1);
    expect(classification.affectedTables).toEqual(['public.users']);
    expect(classification.affectedSchemas).toEqual(['public']);
  });

  it('detects destructive DDL and multi-statement payloads', () => {
    const classification = classifier.classify('DROP DATABASE prod; SELECT 1', 'postgresql');

    expect(classification.type).toBe('ddl');
    expect(classification.policyOperation).toBe('drop');
    expect(classification.statementCount).toBe(2);
    expect(classification.isSensitiveOperation).toBe(true);
    expect(classification.dangerousPatterns).toEqual(expect.arrayContaining(['drop_database', 'multi_statement']));
  });

  it('detects DELETE without WHERE as dangerous', () => {
    const classification = classifier.classify('DELETE FROM accounts', 'mysql');

    expect(classification.type).toBe('write');
    expect(classification.operation).toBe('DELETE');
    expect(classification.hasWhereClause).toBe(false);
    expect(classification.dangerousPatterns).toContain('delete_without_where');
    expect(classification.affectedTables).toEqual(['accounts']);
  });

  it('classifies import and export operations separately from normal reads and writes', () => {
    expect(classifier.classify("COPY users FROM '/tmp/users.csv'", 'postgresql').policyOperation).toBe('import');
    expect(classifier.classify("COPY users TO '/tmp/users.csv'", 'postgresql').policyOperation).toBe('export');
    expect(classifier.classify("UNLOAD (SELECT * FROM users) TO 's3://bucket'", 'athena').policyOperation).toBe('export');
  });

  it('captures complexity signals for joins and nested subqueries', () => {
    const classification = classifier.classify(`
      SELECT * FROM orders
      JOIN users ON users.id = orders.user_id
      JOIN accounts ON accounts.id = users.account_id
      WHERE orders.id IN (SELECT order_id FROM line_items WHERE sku IN (SELECT sku FROM banned_skus))
    `, 'postgresql');

    expect(classification.joinCount).toBe(2);
    expect(classification.subqueryDepth).toBeGreaterThanOrEqual(1);
  });
});
