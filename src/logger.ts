/**
 * Structured logger that writes newline-delimited JSON to stderr only.
 *
 * stdout is reserved for the MCP stdio transport, so anything written there
 * would corrupt the protocol stream. Pattern shared with the LuciVerse
 * aifam-mcp server (lucia_tooling_omzsh/aifam-mcp/src/logger.ts).
 */

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const ORDER: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export type LogFunction = (message: string, data?: unknown, error?: Error) => void;
export type ErrorLogFunction = (message: string, error?: unknown) => void;

export interface BoundLoggers {
  logDebug: LogFunction;
  logInfo: LogFunction;
  logWarn: LogFunction;
  logError: ErrorLogFunction;
}

export class Logger {
  constructor(
    private readonly level: LogLevelName = 'info',
    private readonly scope = 'metabase-mcp'
  ) {}

  child(scope: string): Logger {
    return new Logger(this.level, `${this.scope}:${scope}`);
  }

  private write(level: LogLevelName, msg: string, meta?: unknown, error?: unknown): void {
    if (ORDER[level] < ORDER[this.level]) {
      return;
    }
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      scope: this.scope,
      msg,
    };
    if (meta !== undefined) {
      record.meta = meta;
    }
    if (error !== undefined) {
      const err = error instanceof Error ? error : new Error(String(error));
      record.error = err.message;
      if (err.stack) {
        record.stack = err.stack;
      }
    }
    process.stderr.write(`${JSON.stringify(record)}\n`);
  }

  debug(msg: string, meta?: unknown): void {
    this.write('debug', msg, meta);
  }

  info(msg: string, meta?: unknown): void {
    this.write('info', msg, meta);
  }

  warn(msg: string, meta?: unknown, error?: unknown): void {
    this.write('warn', msg, meta, error);
  }

  error(msg: string, error?: unknown): void {
    this.write('error', msg, undefined, error);
  }

  fatal(msg: string, error?: unknown): void {
    this.write('fatal', msg, undefined, error);
  }

  /**
   * Callbacks in the shape the handler layer expects.
   */
  bound(): BoundLoggers {
    return {
      logDebug: (message, data) => this.debug(message, data),
      logInfo: (message, data) => this.info(message, data),
      logWarn: (message, data, error) => this.warn(message, data, error),
      logError: (message, error) => this.error(message, error),
    };
  }
}
