// cacheFactory.ts
import { BigCacheDB, CacheOptions } from './cacheDB';

const cacheInstances: Map<string, BigCacheDB> = new Map();

export function createCacheDB(options?: CacheOptions): BigCacheDB {
  const dbName = options?.dbName || 'bigCacheDB';
  const storeName = options?.storeName || 'cache';
  const instanceKey = `${dbName}-${storeName}`;

  if (cacheInstances.has(instanceKey)) {
    return cacheInstances.get(instanceKey)!;
  }

  const newInstance = new BigCacheDB(options);
  cacheInstances.set(instanceKey, newInstance);
  
  // 添加清理机制，在页面卸载时关闭所有实例
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      newInstance.close().catch(console.error);
    });
  }
  
  return newInstance;
}