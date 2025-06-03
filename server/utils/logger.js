export const LogLevel = Object.freeze({
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    NONE: 'NONE',
});

const logLevelOrder = {
    [LogLevel.DEBUG]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.WARN]: 3,
    [LogLevel.ERROR]: 4,
    [LogLevel.NONE]: 5,
};

let currentLoggerConfig = {
    minLevel: LogLevel.INFO,
    output: 'console', 
    filePath: './app.log', 
    customOutputFn: null, 
    formatter: (timestamp, level, functionName, message, details) => {
        let logString = `${timestamp} [${level}] (${functionName}): ${message}`;
        if (details && Object.keys(details).length > 0) {
            try {
                const detailsString = JSON.stringify(details, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value, 
                2);
                logString += `\nDetails: ${detailsString.length > 500 ? detailsString.substring(0, 500) + '...' : detailsString}`;
            } catch (e) {
                logString += `\nDetails: (Error stringifying details: ${e.message})`;
            }
        }
        return logString;
    },
    structured: false, 
};

export function configureLogger(config = {}) {
    currentLoggerConfig = { ...currentLoggerConfig, ...config };
    if (config.minLevel && !Object.values(LogLevel).includes(config.minLevel)) {
        console.warn(`[LoggerConfig] Invalid minLevel: ${config.minLevel}. Using default: ${currentLoggerConfig.minLevel}`);
        currentLoggerConfig.minLevel = LogLevel.INFO;
    }
}

function actualLog(level, functionName, message, details) {
    if (!logLevelOrder[level] || logLevelOrder[level] < logLevelOrder[currentLoggerConfig.minLevel]) {
        return;
    }

    const timestamp = new Date().toISOString();
    let logOutput;

    if (currentLoggerConfig.structured) {
        logOutput = {
            timestamp,
            level,
            function: functionName,
            message,
            ...details,
        };
    } else if (currentLoggerConfig.formatter) {
        logOutput = currentLoggerConfig.formatter(timestamp, level, functionName, message, details);
    } else {
        logOutput = `${timestamp} [${level}] (${functionName}): ${message}`;
        if (details) logOutput += ` Details: ${JSON.stringify(details, null, 2)}`;
    }

    if (typeof currentLoggerConfig.customOutputFn === 'function') {
        currentLoggerConfig.customOutputFn(typeof logOutput === 'string' ? logOutput : JSON.stringify(logOutput), level, details);
    } else {
        switch (currentLoggerConfig.output) {
            case 'console':
                const outputToConsole = currentLoggerConfig.structured ? JSON.stringify(logOutput) : logOutput;
                if (level === LogLevel.ERROR) console.error(outputToConsole);
                else if (level === LogLevel.WARN) console.warn(outputToConsole);
                else console.log(outputToConsole);
                break;
            case 'file':
                console.log(`placeholder: FILE LOG (simulated): ${outputToConsole}`); 
                break;
        }
    }
}

export function withLogging(originalFunction, options = {}) {
    const {
        functionName = originalFunction.name || 'anonymousFunction',
        logLevel = LogLevel.INFO,
        profileTime = false,
    } = options;

    return async function (...args) {
        const logDetails = { args: args.map(arg => {
            if (arg && typeof arg.constructor !== 'undefined' && arg.constructor.name === 'Socket') return `[Socket id=${arg.id}]`;
            if (arg && typeof arg.constructor !== 'undefined' && arg.constructor.name === 'Server') return `[Socket.IO Server]`;
            if (typeof arg === 'function') return `[Function ${arg.name || 'anonymous'}]`;
            try {
                return JSON.parse(JSON.stringify(arg));
            } catch (e) {
                return typeof arg === 'object' ? '[Object]' : arg; 
            }
        }) };
        let startTime;

        if (profileTime) {
            startTime = Date.now();
        }

        if (logLevel !== LogLevel.ERROR && logLevelOrder[logLevel] >= logLevelOrder[currentLoggerConfig.minLevel]) {
            actualLog(logLevel, functionName, `Called with arguments.`, logDetails);
        }

        try {
            const result = originalFunction.apply(this, args);
            const resolvedResult = (result instanceof Promise) ? await result : result;

            try {
                logDetails.result = JSON.parse(JSON.stringify(resolvedResult));
            } catch (e) {
                logDetails.result = typeof resolvedResult === 'object' ? '[Object]' : resolvedResult;
            }


            if (profileTime && typeof startTime === 'number') {
                const endTime = Date.now();
                logDetails.executionTime = `${endTime - startTime} ms`;
            }

            if (logLevel !== LogLevel.ERROR && logLevelOrder[logLevel] >= logLevelOrder[currentLoggerConfig.minLevel]) {
                actualLog(logLevel, functionName, `Returned successfully.`, logDetails);
            }
            return resolvedResult;
        } catch (error) {
            const errorDetails = {
                message: error.message,
                ...(error.response?.data && { responseData: error.response.data })
            };
            logDetails.error = errorDetails;


            if (profileTime && typeof startTime === 'number') {
                const endTime = Date.now();
                logDetails.executionTime = `${endTime - startTime} ms (failed)`;
            }

            if (logLevelOrder[LogLevel.ERROR] >= logLevelOrder[currentLoggerConfig.minLevel]) {
                actualLog(LogLevel.ERROR, functionName, `Threw an error.`, logDetails);
            }
            throw error;
        }
    };
}