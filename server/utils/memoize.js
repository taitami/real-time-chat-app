export function createMemoizationLru(funcToMemoize, options = {}) {
    const {
        cacheSize = 100, 
        keyGenerator = (args) => JSON.stringify(args)
    } = options;

    if (typeof funcToMemoize !== 'function') {
        throw new TypeError('funcToMemoize must be a function.');
    }
    if (typeof cacheSize !== 'number' || !isFinite(cacheSize)) {
        throw new TypeError('cacheSize must be a finite number.');
    }
    if (typeof keyGenerator !== 'function') {
        throw new TypeError('keyGenerator must be a function.');
    }

    const cache = new Map(); 

    function deleteOldest() {
        if (cache.size > 0) {
            const oldestKey = cache.keys().next().value
            cache.delete(oldestKey);
        }
    }

    async function memoized(...args) {
        if (cacheSize <= 0) {
            const plainResult = funcToMemoize.apply(this, args);
            return (plainResult instanceof Promise) ? await plainResult : plainResult;
        }

        let key;
        try {
            key = keyGenerator(args);
        } catch (e) {
            const errorKeyResult = funcToMemoize.apply(this, args);
            return (errorKeyResult instanceof Promise) ? await errorKeyResult : errorKeyResult;
        }


        if (cache.has(key)) {
            const cachedValue = cache.get(key);

            cache.delete(key)
            cache.set(key, cachedValue)

            return cachedValue
        }

        const resultPromiseOrValue = funcToMemoize.apply(this, args);
        const result = (resultPromiseOrValue instanceof Promise) ? await resultPromiseOrValue : resultPromiseOrValue;

        if (cache.size >= cacheSize) {
            deleteOldest(); 
        }

        cache.set(key, result);

        return result;
    }

    memoized.invalidateKey = (keyToInvalidate) => {
        if (cache.has(keyToInvalidate)) {
            cache.delete(keyToInvalidate);
            return true;
        }
        return false;
    };

    memoized.invalidateArgs = (...argsToInvalidate) => {
        let key;
        try {
            key = keyGenerator(argsToInvalidate);
        } catch (e) {
            return false;
        }
        return memoized.invalidateKey(key);
    };

    memoized.clearCache = () => {
        cache.clear();
    };

    memoized.getCacheSnapshot = () => {
        const snapshot = new Map();
        for (const [key, value] of cache.entries()) {
            snapshot.set(key, value);
        }
        return snapshot;
    };

    return memoized;
}