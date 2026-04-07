import type { FieldInfo, QueryResult } from '@maitredb/plugin-api';

/** Supported output formats for CLI + programmatic consumers. */
export type OutputFormat = 'table' | 'json' | 'csv' | 'ndjson' | 'yaml' | 'raw';

/** Minimal contract implemented by every formatter. */
export interface Formatter {
  format(result: QueryResult): string;
}

/** Factory that returns the formatter matching a requested {@link OutputFormat}. */
export function getFormatter(format: OutputFormat): Formatter {
  switch (format) {
    case 'table': return new TableFormatter();
    case 'json': return new JsonFormatter();
    case 'csv': return new CsvFormatter();
    case 'ndjson': return new NdjsonFormatter();
    case 'raw': return new RawFormatter();
    default: return new JsonFormatter();
  }
}

/** Pick a sensible default formatter depending on whether stdout is a TTY. */
export function autoDetectFormat(): OutputFormat {
  return process.stdout.isTTY ? 'table' : 'ndjson';
}

class JsonFormatter implements Formatter {
  format(result: QueryResult): string {
    return JSON.stringify({
      rows: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      durationMs: result.durationMs
    }, null, 2);
  }
}

class NdjsonFormatter implements Formatter {
  format(result: QueryResult): string {
    return result.rows.map(r => JSON.stringify(r)).join('\n');
  }
}

class RawFormatter implements Formatter {
  format(result: QueryResult): string {
    if (result.rows.length === 0) return '';
    const cols = result.fields.map(f => f.name);
    return result.rows
      .map(row => cols.map(c => String(row[c] ?? '')).join('\t'))
      .join('\n');
  }
}

class CsvFormatter implements Formatter {
  format(result: QueryResult): string {
    if (result.rows.length === 0) return '';
    const cols = result.fields.map(f => f.name);
    const header = cols.map(c => this.escape(c)).join(',');
    const rows = result.rows.map(row =>
      cols.map(c => this.escape(String(row[c] ?? ''))).join(','),
    );
    return [header, ...rows].join('\n');
  }

  private escape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}

class TableFormatter implements Formatter {
  format(result: QueryResult): string {
    if (result.rows.length === 0) return `(0 rows) (${result.durationMs.toFixed(2)} ms)`;

    const cols = result.fields.map(f => f.name);

    // Calculate column widths
    const widths = cols.map(c => c.length);
    for (const row of result.rows) {
      for (let i = 0; i < cols.length; i++) {
        const val = this.displayValue(row[cols[i]!]);
        widths[i] = Math.max(widths[i]!, val.length);
      }
    }

    const sep = widths.map(w => '─'.repeat(w! + 2)).join('┼');
    const header = cols.map((c, i) => ` ${c.padEnd(widths[i]!)} `).join('│');

    const rows = result.rows.map(row =>
      cols.map((c, i) => ` ${this.displayValue(row[c]).padEnd(widths[i]!)} `).join('│'),
    );

    const lines = [header, sep, ...rows];
    lines.push(`(${result.rowCount} row${result.rowCount === 1 ? '' : 's'}) (${result.durationMs.toFixed(2)} ms)`);
    return lines.join('\n');
  }

  private displayValue(val: unknown): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }
}
