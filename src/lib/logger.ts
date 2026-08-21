// ============================================================
// REZZO Structured Logger
// ============================================================
//
// V1 had no logging discipline at all — errors in "best-effort" paths
// (notifications, webhooks, audit writes) were silently swallowed with a
// bare `catch {}` and a comment, so a real failure in production would
// leave no trace anywhere. This doesn't add a log aggregator (no
// credentials for one, same as PostHog/WhatsApp) — it gives every log line
// a consistent, machine-parseable JSON shape on stdout, which is what most
// hosting platforms (Vercel, Railway, a plain `docker logs`) already
// ingest and index without any extra setup.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? serializeContext(context) : {}),
  };
  const json = JSON.stringify(line);
  if (level === 'error') console.error(json);
  else if (level === 'warn') console.warn(json);
  else console.log(json);
}

// Error objects don't serialize usefully through JSON.stringify (own
// enumerable properties only, which excludes `message`/`stack`) — pull
// those out explicitly so an { error: someErr } context actually shows up.
function serializeContext(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message, stack: value.stack };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};
