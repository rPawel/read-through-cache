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
    const testKey = 'testKey'
    const testData = {param: "value"}
    const testAltData = {param: "altValue"}
    const emptyData = {param: "value"}
    const callTime = Math.round(new Date().getTime() / 1000)

    beforeEach(done => {
        redisClient.del(testKey, () => done());
    })

    it('redis returns an error so readFunction is used', done => {
        faultyReadThroughCache
            .get(testKey, readFunctionReturningData(testData), 0)
            .then((data) => {
                expect(data).toEqual(testData)
                done();
            })

    })

    it('cache is empty so readFunction is used', done => {

        readThroughCache
            .get(testKey, readFunctionReturningData(testData), 0)
            .then((data) => {
                expect(data).toEqual(testData)
                done();
            })

    })

    it('cache has responded with data, data is valid', done => {

        setAsync(testKey, JSON.stringify(toRaw(testData))).then(() => {

            readThroughCache
                .get(testKey, readFunctionReturningData(null), 0)
                .then((data) => {
                    expect(data).toEqual(testData)
                    done();
                })

        })
    })

    it('cache has responded with data, data is invalid, calling readFunction', done => {

        setAsync(testKey, JSON.stringify(toRaw(emptyData))).then(() => {

            readThroughCache
                .get(testKey, readFunctionReturningData(testData), 0, () => false)
                .then((data) => {
                    expect(data).toEqual(testData)
                    done();
                });

        })
    })

    it('readFunction is called, but it returns an error', async () => {

        let error = 'read function error';
        await expect(readThroughCache.get(testKey, readFunctionReturningAnError(error))).rejects.toThrow()
    })

    it('readFunction is called, valid data is stored in cache and returned', async () => {

        await readThroughCache.get(testKey, readFunctionReturningData(testData));
        let actualInRedis = await getAsync(testKey);
        expect(JSON.parse(actualInRedis).data).toEqual(testData)
    })


    it('readFunction is called, data saving fails, data still returned', async () => {

        await readThroughCache.get(testKey, readFunctionReturningData(testData));
    })

    it('readFunction is called, cache is empty, read data is invalid hence not stored, data is returned', async () => {

        let data = await readThroughCache
            .get(testKey, readFunctionReturningData(testData), 0, () => false, () => false)

        let actualInRedis = await getAsync(testKey);

        expect(data).toEqual(testData)
        expect(actualInRedis).toEqual(null)
    })

    it('readFunction is called, cached data is invalid, read data is invalid hence not stored, data is returned', async () => {

        await setAsync(testKey, JSON.stringify(toRaw(emptyData)))

        let data = await readThroughCache
            .get(testKey, readFunctionReturningData(testData), 0, () => false, () => false)

        let actualInRedis = await getAsync(testKey);

        expect(data).toEqual(testData)
        expect(JSON.parse(actualInRedis).data).toEqual(emptyData)
    })

    it('readFunction is called, cached data is unstable, read data is valid but not stored, data is returned', async () => {

        await setAsync(testKey, JSON.stringify(toRaw(testAltData)))

        let data = await readThroughCache
            .get(testKey, readFunctionReturningData(testData), 0, () => ReadThroughCache.Unstable, () => false)

        let actualInRedis = await getAsync(testKey);

        expect(data).toEqual(testData)
        expect(JSON.parse(actualInRedis).data).toEqual(testAltData)
    })

    const readFunctionReturningData = data => new Promise(resolve => resolve(data));

    const readFunctionReturningAnError = err => new Promise((resolve, reject) => reject(new Error(err)));

    const toRaw = (someData) => {
        return {
            data: someData,
            meta: {created: callTime}
        }
    };


    afterAll(done => {
        redisClient.quit(done());
    })
})
