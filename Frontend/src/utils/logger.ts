type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();

    // Friendly console output in browser
    switch (level) {
      case 'error':
        console.error(`[${timestamp}] [ERROR] ${message}`, meta || '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN] ${message}`, meta || '');
        break;
      case 'debug':
        if (import.meta.env.DEV) console.debug(`[${timestamp}] [DEBUG] ${message}`, meta || '');
        break;
      default:
        console.log(`[${timestamp}] [INFO] ${message}`, meta || '');
    }

    // TODO: send critical logs to backend logging endpoint if configured
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }
}

export const logger = new Logger();
export default logger;
