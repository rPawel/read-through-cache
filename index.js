'use strict';
const {promisify} = require("util");

class ReadThroughCache {
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
              cacheValidator = () => true) {

        let redisData = null;
        try {
            redisData = await this.getAsync(key);
        } catch (e) {
            return this.readData(key, ttl, readFunction);
        }
        if (redisData == null) {
            return this.readData(key, ttl, readFunction);
        }
        try {
            const parsedJson = JSON.parse(redisData)
            const data = parsedJson.data;
            const meta = parsedJson.meta;
            if (cacheValidator(data, meta)) {
                return data;
            } else {
                return this.readData(key, ttl, readFunction);
            }
        } catch (e) {
            return this.readData(key, ttl, readFunction);
        }
    }

    async readData(key, ttl, readFunction) {
        let freshData = await readFunction;

        const callTime = Math.round(new Date().getTime() / 1000);
        let dataWithMeta = {data: freshData, meta: {created: callTime}}
        if (ttl > 0) {
            this.setExAsync(key, ttl, JSON.stringify(dataWithMeta)).then()
        } else {
            this.setAsync(key, JSON.stringify(dataWithMeta)).then()
        }

        return freshData;
    }
}

module.exports = ReadThroughCache;
