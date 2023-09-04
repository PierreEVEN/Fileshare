const winston = require("winston");

const logger = winston.createLogger();

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.align(),
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({level, message, label, timestamp}) => {
                return `[${timestamp}] ${level}: ${message}`;
            }),
        )
    }));
}

logger.add(new winston.transports.File({
    filename: 'logs/errors.log',
    level: 'error',
    format: winston.format.combine(
        winston.format.align(),
        winston.format.timestamp(),
        winston.format.printf(({level, message, label, timestamp}) => {
            return `[${timestamp}] ${level}: ${message}`;
        }),
    ),
}));

logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    options: {flags: 'w'},
    format: winston.format.combine(
        winston.format.align(),
        winston.format.timestamp(),
        winston.format.printf(({level, message, label, timestamp}) => {
            return `[${timestamp}] ${level}: ${message}`;
        }),
    ),
}));

module.exports = {logger}