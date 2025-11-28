# install

```
 npm install @hexueguo/big-cache-db

```


# usage
```
基础用法

import { BigCacheDB } from '@hexueguo/big-cache-db'

const bigCacheDB = new BigCacheDB({
  dbName: "bigCacheDB", // db name
  storeName: "cache", // store name
  maxTotalBytes: 100 * 1024 * 1024, // 100MB
  maxEntryBytes: 30 * 1024 * 1024, // 30MB 单条上限
  defaultTTLSeconds: 3600,         // 1小时默认过期
  writeDebounceMs: 50, // 高频写入合并，单位毫秒
  cleanupIntervalMs: 30 * 1000,    // 30s 清理一次
  enablePersist: true, // 是否开启持久化，默认开启
  enableBroadcast: true, // 是否开启广播，默认开启
  broadcastChannelName: "big-cache-bc", // 广播频道名称
  module: "default", // 模块名称，用于区分不同模块的缓存
});


或者使用工厂模式

import { createCacheDB } from "./index";

const cacheDB = createCacheDB({
  dbName: "bigCacheDB", // db name
  storeName: "cache", // store name
  maxTotalBytes: 100 * 1024 * 1024, // 100MB
  maxEntryBytes: 30 * 1024 * 1024, // 30MB 单条上限
  defaultTTLSeconds: 3600, // 1小时默认过期
  writeDebounceMs: 50, // 高频写入合并，单位毫秒
  cleanupIntervalMs: 30 * 1000, // 30s 清理一次
  enablePersist: true, // 是否开启持久化，默认开启
  enableBroadcast: true, // 是否开启广播，默认开启
  broadcastChannelName: "big-cache-bc", // 广播频道名称
  module: "default", // 模块名称，用于区分不同模块的缓存
});

createCacheDB使用工厂模式，可以创建多个实例，根据`${dbName}-${storeName}`作为唯一标识，避免冲突

```