import fs from 'fs';
import path from 'path';

const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
} catch (e) {
  // ignore directory creation errors; fallback to console-only logging
}

const logFile = path.join(logsDir, 'server.log');

function formatLine(level: string, message: string) {
  const ts = new Date().toISOString();
  return `${ts} [${process.pid}] ${level}: ${message}`;
}

function append(line: string) {
  try {
    fs.appendFile(logFile, line + '\n', () => {});
  } catch (e) {
    // swallow file write errors
  }
}

export const logger = {
  info: (msg: string) => {
    const line = formatLine('INFO', msg);
    // eslint-disable-next-line no-console
    console.log(line);
    append(line);
  },
  warn: (msg: string) => {
    const line = formatLine('WARN', msg);
    // eslint-disable-next-line no-console
    console.warn(line);
    append(line);
  },
  error: (msg: string) => {
    const line = formatLine('ERROR', msg);
    // eslint-disable-next-line no-console
    console.error(line);
    append(line);
  }
};

export default logger;
