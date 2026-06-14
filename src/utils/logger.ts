/**
 * Minimal structured logger. All ARE-significant lines are prefixed `[ARE]`
 * so examiners (and scripts) can grep proof of behavior from container logs.
 */
type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, msg: string): void {
  const line = `${new Date().toISOString()} ${msg}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string) => emit('info', msg),
  warn: (msg: string) => emit('warn', `[WARN] ${msg}`),
  error: (msg: string) => emit('error', `[ERROR] ${msg}`),
  debug: (msg: string) => {
    if (process.env.ARE_DEBUG) emit('debug', `[DEBUG] ${msg}`);
  },
  /** ARE-namespaced line, e.g. logger.are('Strategy selected: SSG'). */
  are: (msg: string) => emit('info', `[ARE] ${msg}`),
};
