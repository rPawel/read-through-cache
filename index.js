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
        this.setAsync = promisify(client.set).bind(client);
        this.delAsync = promisify(client.del).bind(client);
    }

    async get(key,
              readFunction,
              ttl = 0,
              cachedDataValidator = () => true,
              freshDataValidator = () => true) {

        let redisData = null;
        const callTime = Math.round(new Date().getTime() / 1000);
        try {
            redisData = await this.getAsync(key);
        } catch (e) {
            return this.readData(key, readFunction, freshDataValidator, false, {}, callTime);
        }
        if (redisData == null) {
            return this.readData(key, readFunction, freshDataValidator, false, {}, callTime);
        }
        try {
            const parsedJson = JSON.parse(redisData)
            const data = parsedJson.data;
            const meta = parsedJson.meta;
            const cacheExpired = (ttl > 0) && ((meta.updated + ttl) < callTime)
            if (cacheExpired) {
                return this.readData(key, readFunction, freshDataValidator, false, meta, callTime);
            } else {
                switch (cachedDataValidator(data, meta)) {
                    case ReadThroughCache.Valid:
                        return data;
                    case ReadThroughCache.Unstable:
                        return this.readData(key, readFunction, freshDataValidator, true, meta, callTime);
                    default:
                        return this.readData(key, readFunction, freshDataValidator, false, meta, callTime);
                }
            }
        } catch (e) {
            return this.readData(key, readFunction, freshDataValidator, false, {}, callTime);
        }
    }

    async readData(key, readFunction, freshDataValidator, skipSaving, meta = {}, callTime) {
        let freshData = readFunction();

        if (!skipSaving) {
            if (freshDataValidator(freshData)) {
                let createdTime, updateTime;
                if (Object.entries(meta).length === 0) {
                    createdTime = callTime;
                    updateTime = callTime;
                } else {
                    createdTime = meta.created;
                    updateTime = callTime;
                }

                let dataWithMeta = {data: freshData, meta: {created: createdTime, updated: updateTime}}
                this.setAsync(key, JSON.stringify(dataWithMeta)).then()

            } else {
                this.delAsync(key).then()
            }
        }
        return freshData;
    }
}

module.exports = ReadThroughCache;
