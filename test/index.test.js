const ReadThroughCache = require('../index');
const {promisify} = require("util");
const redis = require("redis-mock"),
    redisClient = redis.createClient(),
    faultyRedisClient = redis.createClient({port: '0'}),
    readThroughCache = new ReadThroughCache(redisClient),
    faultyReadThroughCache = new ReadThroughCache(faultyRedisClient),
    getAsync = promisify(redisClient.get).bind(redisClient),
    setAsync = promisify(redisClient.set).bind(redisClient);

describe('get - upon checking for key', () => {
    const testKey = 'testKey';
    const testData = {param: "value"};
    const testData2 = {param: "value2"};
    const emptyData = {};
    const now = Math.round(new Date().getTime() / 1000);
    const anHourAgo = now - 3600;

    beforeEach(done => {
        redisClient.del(testKey, () => done());
    })

    it('redis returns an error so readFunction is used', done => {
        const readFunction = jest.fn().mockImplementation(() => testData)
        faultyReadThroughCache
            .get(testKey, readFunction, 0)
            .then((data) => {
                expect(data).toEqual(testData);
                expect(readFunction).toHaveBeenCalledTimes(1);
                done();
            });

    })

    it('cache is empty so readFunction is used', done => {

        const readFunction = jest.fn().mockImplementation(() => testData)
        readThroughCache
            .get(testKey, readFunction, 0)
            .then((data) => {
                expect(data).toEqual(testData);
                expect(readFunction).toHaveBeenCalledTimes(1);
                done();
            });

    })

    it('cache has responded with data, data is valid', done => {

        setAsync(testKey, JSON.stringify(toRaw(testData, anHourAgo, anHourAgo))).then(() => {

            const readFunction = jest.fn();
            readThroughCache
                .get(testKey, readFunction, 0)
                .then((data) => {
                    expect(data).toEqual(testData);
                    expect(readFunction).not.toHaveBeenCalled();
                    done();
                });


        })
    })

    it('cache has responded with data, data is invalid, calling readFunction', done => {

        setAsync(testKey, JSON.stringify(toRaw(emptyData))).then(() => {

            const readFunction = jest.fn().mockImplementation(() => testData)
            readThroughCache
                .get(testKey, readFunction, 0, () => false)
                .then((data) => {
                    expect(data).toEqual(testData)
                    expect(readFunction).toHaveBeenCalledTimes(1);
                    done();
                });

        });
    })

    it('readFunction is called, valid data is stored in cache and returned', async () => {

        const readFunction = jest.fn().mockImplementation(() => testData)
        await readThroughCache.get(testKey, readFunction);
        let actualInRedis = JSON.parse(await getAsync(testKey));
        expect(readFunction).toHaveBeenCalledTimes(1);
        expect(actualInRedis.data).toEqual(testData);
        expect(actualInRedis.meta.created).toBeCloseTo(now, -1)
        expect(actualInRedis.meta.updated).toBeCloseTo(now, -1)

    })


    it('readFunction is called, cache is empty, read data is invalid hence not stored, data is returned', async () => {

        const readFunction = jest.fn().mockImplementation(() => testData)

        let data = await readThroughCache.get(testKey, readFunction, 0, () => false, () => false);

        let actualInRedis = await getAsync(testKey);

        expect(readFunction).toHaveBeenCalledTimes(1);
        expect(data).toEqual(testData);
        expect(actualInRedis).toEqual(null);
    })

    it('readFunction is called, cached data is invalid, read data is invalid hence not stored, cache is removed, data is returned', async () => {

        const readFunction = jest.fn().mockImplementation(() => testData)
        await setAsync(testKey, JSON.stringify(toRaw(emptyData, anHourAgo, anHourAgo)));

        let data = await readThroughCache.get(testKey, readFunction, 0, () => false, () => false);

        let actualInRedis = await getAsync(testKey);

        expect(readFunction).toHaveBeenCalledTimes(1);
        expect(data).toEqual(testData);
        expect(actualInRedis).toEqual(null);
    })

    it('readFunction is called, cached data is unstable, read data is valid but not stored, data is returned', async () => {

        const readFunction = jest.fn().mockImplementation(() => testData)
        await setAsync(testKey, JSON.stringify(toRaw(testData2, anHourAgo, anHourAgo)));

        let data = await readThroughCache.get(testKey, readFunction, 0, () => ReadThroughCache.Unstable, () => false);

        let actualInRedis = JSON.parse(await getAsync(testKey));

        expect(readFunction).toHaveBeenCalledTimes(1);
        expect(data).toEqual(testData);
        expect(actualInRedis.data).toEqual(testData2);
        expect(actualInRedis.meta.created).toBeCloseTo(anHourAgo, -1)
        expect(actualInRedis.meta.updated).toBeCloseTo(anHourAgo, -1)
    })

    it('readFunction is called, cached data was valid but has just expired, read data is invalid hence the cache is pruned', async () => {

        const readFunction = jest.fn().mockImplementation(() => testData)
        await setAsync(testKey, JSON.stringify(toRaw(testData, anHourAgo, anHourAgo)));

        let data = await readThroughCache.get(testKey, readFunction, 60, () => true, () => false);

        let actualInRedis = await getAsync(testKey);

        expect(readFunction).toHaveBeenCalledTimes(1);
        expect(data).toEqual(testData);
        expect(actualInRedis).toEqual(null)

    })

    it('readFunction is called, cached data was valid but has just expired, read data is valid hence the cache is extended', async () => {

        const readFunction = jest.fn().mockImplementation(() => testData)
        await setAsync(testKey, JSON.stringify(toRaw(testData, anHourAgo, anHourAgo)));

        let data = await readThroughCache.get(testKey, readFunction, 60, () => true, () => true);

        let actualInRedis = JSON.parse(await getAsync(testKey));

        expect(readFunction).toHaveBeenCalledTimes(1);
        expect(data).toEqual(testData);
        expect(actualInRedis.data).toEqual(testData)
        expect(actualInRedis.meta.created).toBeCloseTo(anHourAgo, -1)
        expect(actualInRedis.meta.updated).toBeCloseTo(now, -1)
    })

    const toRaw = (someData, createdTime = now, updatedTime = now) => {
        return {
            data: someData,
            meta: {
                created: createdTime,
                updated: updatedTime
            }
        }
    };

    afterAll(done => {
        redisClient.quit(done());
    })
})
