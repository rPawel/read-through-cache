## What is this?

A simple Read-Through Cache implementation allowing to wrap your slow function and cache its responses in Redis.  
It's special optional feature is to defer returning cached data based on a validator function.  
For instance, for a given period of time after first save to cache, fresh data is still returned.  
It can be useful when dealing with humans still tinkering with data or unstable DNS records.

# Installation
`npm i redis-read-through-cache --save`

My slow function ...
```javascript
const readFunction = () => {
                       return "data";
                     }
```
   
Simple async/await version:
```javascript
let data = await readThroughCache.get(testKey, readFunction);
```
   
Promise with cache validator method:
```javascript
readThroughCache
    .get(
        testKey,
        readFunction,
        60,
        (data, meta) => { return meta.created > 0 }
    )
    .then(data => {
        processMyData(data);
    })
```

Let's avoid returning cached data until it "settles".
```javascript
const isCachedDataValid = function (data, meta) {
    const now = Math.round(new Date().getTime() / 1000);
    const oldEnough = (now - meta.created) > moment.duration(60, "seconds").asSeconds();
    if (oldEnough) return ReadThroughCache.Valid;
    else return ReadThroughCache.Unstable;
}

readThroughCache
    .get(
        testKey,
        readFunction,
        60,
        isCachedDataValid
    )
    .then(data => {
        processMyData(data);
    })
```

## Options

* *key* - Cache key name
* *readFunction* - The actual function that returns a promise that fetches the data.
* *ttl* - Optional cache expiration time in seconds.
* *cachedDataValidator* - Optional function returning boolean that checks if cache data is valid. Returning false forces to fetch data from readFunction.
* *freshDataValidator* - Optional function returning boolean that checks if fresh data is valid. Returning false skips saving to cache.
