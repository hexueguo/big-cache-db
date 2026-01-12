// 示例用法
import { BigCacheDB, createCacheDB } from "./index";

console.log('=== BigCacheDB 使用示例 ===');

// 方法1: 直接创建实例
const bigCacheDB = new BigCacheDB({
  dbName: "my-intranet-cache",
  storeName: "my-intranet-cache-store",
  maxTotalBytes: 100 * 1024 * 1024, // 100MB
  maxEntryBytes: 5 * 1024 * 1024, // 5MB 单条上限
  defaultTTLSeconds: 60 * 5, // 5 分钟默认过期（高频更新场景通常短 TTL）
  writeDebounceMs: 30, // 高频写入合并
  cleanupIntervalMs: 15 * 1000, // 15s 清理一次
});

// 方法2: 使用工厂函数创建实例
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

async function demo() {
  console.log('开始演示缓存操作...');
  
  // 设置数据
  await bigCacheDB.set('user:123', { id: 123, name: 'Alice', email: 'alice@example.com' }, {
    expireSeconds: 300, // 5分钟后过期
    protected: true, // 受保护，不会被LRU清理
    module: 'users'
  });
  
  // 获取数据
  const userData = await bigCacheDB.get('user:123');
  console.log('获取到用户数据:', userData);
  
  // 检查键是否存在
  const hasUser = await bigCacheDB.has('user:123');
  console.log('用户数据是否存在:', hasUser);
  
  // 设置普通数据
  await bigCacheDB.set('session:token', 'abc123xyz', { expireSeconds: 3600 });
  
  // 获取所有键
  const keys = await bigCacheDB.keys();
  console.log('当前缓存中的键:', keys);
  
  // 获取统计信息
  const stats = await bigCacheDB.stats();
  console.log('缓存统计:', stats);
  
  // 删除数据
  await bigCacheDB.delete('session:token');
  console.log('已删除 session:token');
  
  // 再次获取统计信息
  const statsAfterDelete = await bigCacheDB.stats();
  console.log('删除后的缓存统计:', statsAfterDelete);
  
  // 演示完成后关闭数据库连接
  await bigCacheDB.close();
  console.log('数据库已关闭');
}

// 运行演示
if (typeof window !== 'undefined') {
  demo().catch(console.error);
} else {
  console.log('此示例需要在浏览器环境中运行');
}

