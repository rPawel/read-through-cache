## What is this?

A simple Read-Through Cache implementation allowing to wrap your slow function and cache it's responses in Redis.

# Installation
`npm i redis-read-through-cache --save`

My slow function ...
```javascript
const readFunction = async () => {
                       return "data";
                     }
```
   
Simple async/await version:
```javascript
let data = await readThroughCache.get(testKey, readFunction());
```
   
Promise with cache validator method:
```javascript
readThroughCache
    .get(
        testKey,
        readFunction(),
        60,
        (data, meta) => { return meta.created > 0 }
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
