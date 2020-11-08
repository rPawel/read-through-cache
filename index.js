'use strict';
const {promisify} = require("util");

class ReadThroughCache {
    static Unstable = 2;
    static Valid = true;
    static Invalid = false;

    constructor(client) {
        this.setClient(client)
    }

    setClient(client) {
        this.getAsync = promisify(client.get).bind(client);
        this.setExAsync = promisify(client.setex).bind(client);
        this.setAsync = promisify(client.set).bind(client);
    }

    async get(key,
              readFunction,
              ttl = 0,
              cachedDataValidator = () => true,
              freshDataValidator = () => true) {

        let redisData = null;
        try {
            redisData = await this.getAsync(key);
        } catch (e) {
            return this.readData(key, ttl, readFunction, freshDataValidator);
        }
        if (redisData == null) {
            return this.readData(key, ttl, readFunction, freshDataValidator);
        }
        try {
            const parsedJson = JSON.parse(redisData)
            const data = parsedJson.data;
            const meta = parsedJson.meta;
            switch (cachedDataValidator(data, meta)) {
                case ReadThroughCache.Valid: return data;
                case ReadThroughCache.Unstable: return this.readData(key, ttl, readFunction, freshDataValidator, true);
                default: return this.readData(key, ttl, readFunction, freshDataValidator, false);
            }
        } catch (e) {
            return this.readData(key, ttl, readFunction, freshDataValidator);
        }
    }

    async readData(key, ttl, readFunction, freshDataValidator, skipSaving) {
        let freshData = await readFunction;

        if (!skipSaving && freshDataValidator(freshData)) {

            const callTime = Math.round(new Date().getTime() / 1000);
            let dataWithMeta = {data: freshData, meta: {created: callTime}}
            if (ttl > 0) {
                this.setExAsync(key, ttl, JSON.stringify(dataWithMeta)).then()
            } else {
                this.setAsync(key, JSON.stringify(dataWithMeta)).then()
            }
        }

        return freshData;
    }
}

module.exports = ReadThroughCache;
