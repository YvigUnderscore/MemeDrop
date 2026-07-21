import { config } from './config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[config.logLevel] ?? LEVELS.info;

function ts() {
  return new Date().toISOString();
}

function fmt(level, args) {
  const color = { error: 31, warn: 33, info: 36, debug: 90 }[level] || 0;
  const prefix = `\x1b[${color}m[${ts()}] ${level.toUpperCase().padEnd(5)}\x1b[0m`;
  return [prefix, ...args];
}

export const logger = {
  error: (...a) => current >= LEVELS.error && console.error(...fmt('error', a)),
  warn: (...a) => current >= LEVELS.warn && console.warn(...fmt('warn', a)),
  info: (...a) => current >= LEVELS.info && console.log(...fmt('info', a)),
  debug: (...a) => current >= LEVELS.debug && console.log(...fmt('debug', a)),
};
