# BigCacheDB

一个基于 IndexedDB 的高性能大容量缓存库，支持容量限制、过期策略、LRU 清理和多标签页同步等功能。

## 安装

```
npm install @hexueguo/big-cache-db
```

## 特性

- **大容量存储**：支持总容量限制和单条数据限制
- **过期策略**：支持 TTL 过期机制
- **写入去抖**：高频写入合并，减少数据库操作
- **LRU 清理**：超出容量时自动清理最久未使用的数据
- **多标签页同步**：通过 BroadcastChannel 实现多标签页间的数据同步
- **持久化支持**：向浏览器申请持久化存储权限
- **模块化分组**：支持按模块对缓存数据进行逻辑分组
- **受保护数据**：支持设置某些数据不受清理影响

## 使用方法

### 基础用法

```typescript
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
```

### 工厂模式

```typescript
import { createCacheDB } from '@hexueguo/big-cache-db';

// 工厂模式可以确保相同配置的实例只创建一次
const cacheDB = createCacheDB({
  dbName: "my-cache-db",
  storeName: "cache-store",
  maxTotalBytes: 100 * 1024 * 1024,
  // ... 其他配置
});

```

- createCacheDB使用工厂模式，可以创建多个实例，根据`${dbName}-${storeName}`作为唯一标识，避免冲突

### API 使用示例

```typescript
// 设置数据，可选配置过期时间、模块分组和保护状态
await cacheDB.set('key', data, {
  expireSeconds: 300,  // 5分钟后过期
  module: 'user-data', // 模块分组
  protected: true      // 受保护，不会被LRU清理
});

// 获取数据
const data = await cacheDB.get('key');

// 检查键是否存在
const exists = await cacheDB.has('key');

// 删除数据
await cacheDB.delete('key');

// 获取所有键
const keys = await cacheDB.keys();

// 获取统计信息
const stats = await cacheDB.stats();

// 清空所有数据
await cacheDB.clear();

// 关闭数据库连接
await cacheDB.close();
```

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| dbName | string | "bigCacheDB" | 数据库名称 |
| storeName | string | "cache" | 存储表名称 |
| maxTotalBytes | number | 209715200 (200MB) | 总容量上限（字节） |
| maxEntryBytes | number | 31457280 (30MB) | 单条数据上限（字节） |
| defaultTTLSeconds | number | 3600 | 默认过期时间（秒），0表示不过期 |
| writeDebounceMs | number | 50 | 写入去抖时间（毫秒） |
| cleanupIntervalMs | number | 30000 | 后台清理间隔（毫秒） |
| enablePersist | boolean | true | 是否申请持久化存储权限 |
| enableBroadcast | boolean | true | 是否启用多标签页同步 |
| broadcastChannelName | string | "big-cache-bc" | 广播频道名称 |
| module | string | "default" | 默认模块分组 |

## SetOptions 选项

| 选项 | 类型 | 描述 |
|------|------|------|
| expireSeconds | number | 过期时间（秒），0表示不过期 |
| module | string | 数据模块分组 |
| protected | boolean | 是否受保护，受保护的数据不会被LRU清理 |

## 注意事项

1. 此库依赖 IndexedDB，需要在浏览器环境中运行
2. 单条数据大小不能超过 `maxEntryBytes` 限制
3. 建议在页面卸载前调用 `close()` 方法关闭数据库连接
4. 多标签页同步功能依赖 BroadcastChannel API

## License

ISC