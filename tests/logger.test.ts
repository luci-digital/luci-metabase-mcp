import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger } from '../src/logger.js';

function capture() {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    lines.push(String(chunk));
    return true;
  });
  return { lines, spy };
}

describe('Logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes JSON lines to stderr with timestamp, level, scope, and message', () => {
    const { lines } = capture();
    new Logger('debug', 'test').info('hello', { a: 1 });
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record).toMatchObject({ level: 'info', scope: 'test', msg: 'hello', meta: { a: 1 } });
    expect(typeof record.ts).toBe('string');
  });

  it('filters records below the configured level', () => {
    const { lines } = capture();
    const log = new Logger('warn');
    log.debug('no');
    log.info('no');
    log.warn('yes');
    log.error('yes');
    log.fatal('yes');
    expect(lines.map(line => JSON.parse(line).level)).toEqual(['warn', 'error', 'fatal']);
  });

  it('nests child scopes', () => {
    const { lines } = capture();
    new Logger('info', 'root').child('tools').child('search').info('x');
    expect(JSON.parse(lines[0]).scope).toBe('root:tools:search');
  });

  it('serializes errors and non-Error values', () => {
    const { lines } = capture();
    const log = new Logger('info');
    log.error('boom', new Error('kaboom'));
    log.error('boom2', 'plain string');
    expect(JSON.parse(lines[0]).error).toBe('kaboom');
    expect(JSON.parse(lines[0]).stack).toContain('kaboom');
    expect(JSON.parse(lines[1]).error).toBe('plain string');
  });

  it('exposes bound callbacks for the handler layer', () => {
    const { lines } = capture();
    const { logDebug, logInfo, logWarn, logError } = new Logger('debug').bound();
    logDebug('d', { k: 1 });
    logInfo('i');
    logWarn('w', undefined, new Error('warned'));
    logError('e', new Error('errored'));
    const records = lines.map(line => JSON.parse(line));
    expect(records.map(r => r.level)).toEqual(['debug', 'info', 'warn', 'error']);
    expect(records[2].error).toBe('warned');
    expect(records[3].error).toBe('errored');
  });
});
