// cacheDB.ts
import Dexie, { Table } from "dexie";

type CacheRecord<T = any> = {
  key: string; // 唯一 key
  module?: string; // 逻辑分组
  data: T; // 实际数据 (JSON-able)
  size: number; // 估算字节数
  updatedAt: number; // ms timestamp
  expireAt?: number; // ms timestamp 可选
  protected?: boolean; // 是否保护，永久不会被清理
};

export type CacheOptions = {
  dbName?: string; // 数据库名称
  storeName?: string; // 表名称
  maxTotalBytes?: number; // 总容量上限（字节） 默认 200MB
  maxEntryBytes?: number; // 单条数据上限（字节） 默认 30MB
  defaultTTLSeconds?: number; // 默认过期时间（秒） 默认 3600；如果设置为0，则不自动清理过期数据，但是会因于内存限制自动清理
  writeDebounceMs?: number; // 写入去抖（合并高频更新）默认 50ms
  cleanupIntervalMs?: number; // 后台清理间隔 默认 30s
  enablePersist?: boolean; // 是否向浏览器申请持久化权限
  enableBroadcast?: boolean; // 多 tab 同步
  broadcastChannelName?: string; // 同步广播 channel 名称
  module?: string; // 逻辑分组
};

const DEFAULTS: Required<CacheOptions> = {
  dbName: "bigCacheDB",
  storeName: "cache",
  maxTotalBytes: 200 * 1024 * 1024,
  maxEntryBytes: 30 * 1024 * 1024,
  defaultTTLSeconds: 3600,
  writeDebounceMs: 50,
  cleanupIntervalMs: 30 * 1000,
  enablePersist: true,
  enableBroadcast: true,
  broadcastChannelName: "big-cache-bc",
  module: "default",
};

/**
 * utility: approximate byte size of JSONable object
 * This is fast and conservative: use JSON.stringify length in bytes (UTF-16 -> approx bytes)
 */
function estimateBytes(obj: any): number {
  if (obj == null) return 0;
  // string length in JS uses UTF-16 code units; for estimation OK.
  const str = typeof obj === "string" ? obj : JSON.stringify(obj);
  // assume 1 char = 1 byte for estimation might undercount for multibyte, but OK for LRU heuristics.
  return new Blob([str]).size;
}

export class BigCacheDB {
  private db: Dexie;
  private cache!: Table<CacheRecord, string>;
  private options: Required<CacheOptions>;
  private writeQueue = new Map<string, { data: any; opts?: Partial<CacheOptions & CacheRecord> }>();
  private writeTimer: number | null = null;
  private cleanupTimer: number | null = null;
  private bc: BroadcastChannel | null = null;
  private isClosed = false;

  constructor(opts?: CacheOptions) {
    this.options = { ...DEFAULTS, ...(opts || {}) };
    this.db = new Dexie(this.options.dbName);
    this.db.version(1).stores({
      [this.options.storeName]: "key, module, updatedAt, expireAt, size, protected",
    });
    // @ts-ignore
    this.cache = this.db.table(this.options.storeName) as unknown as Table<CacheRecord, string>;

    if (this.options.enableBroadcast && typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.bc = new BroadcastChannel(this.options.broadcastChannelName);
        this.bc.onmessage = (ev) => this.handleBroadcast(ev.data);
      } catch (e) {
        this.bc = null;
      }
    }

    if (this.options.enablePersist && navigator?.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    // start periodic cleanup
    this.startCleanupTimer();
  }

  // --- Public API ---

  /**
   * set cache (batched, debounced for high-frequency updates)
   * expireSeconds: 0 means no-expire
   */
  async set<T = any>(key: string, data: T, opts?: { expireSeconds?: number; module?: string, protected?: boolean }) {
    if (this.isClosed) throw new Error("BigCacheDB is closed");

    // estimate size and check single-entry limit
    const size = estimateBytes(data);
    if (size > this.options.maxEntryBytes) {
      throw new Error(`Entry too large: ${size} bytes > maxEntryBytes ${this.options.maxEntryBytes}`);
    }

    // enqueue write (merge latest)
    this.writeQueue.set(key, { data: { ...data }, opts: { module: opts?.module, defaultTTLSeconds: opts?.expireSeconds ?? undefined, protected: opts?.protected } });

    // debounce actual write to batch frequent updates
    if (this.writeTimer) window.clearTimeout(this.writeTimer);
    this.writeTimer = window.setTimeout(() => this.flushWriteQueue(), this.options.writeDebounceMs);
  }

  /**
   * immediate set (no debounce) - internal use or fallback
   */
  async setImmediate<T = any>(key: string, data: T, expireSeconds?: number, module?: string) {
    const now = Date.now();
    const size = estimateBytes(data);
    const rec: CacheRecord = {
      key,
      module,
      data,
      size,
      updatedAt: now,
      expireAt: expireSeconds && expireSeconds > 0 ? now + expireSeconds * 1000 : undefined,
    };
    await this.cache.put(rec);
    await this.enforceMaxSize(); // evict if needed
    this.postBroadcast({ type: "set", key });
  }

  async get<T = any>(key: string): Promise<T | null> {
    const row = await this.cache.get(key);
    if (!row) return null;
    if (row.expireAt && row.expireAt < Date.now()) {
      await this.cache.delete(key);
      this.postBroadcast({ type: "delete", key });
      return null;
    }
    // update access time for LRU - mark updatedAt
    await this.cache.update(key, { updatedAt: Date.now() });
    return row.data as T;
  }

  async has(key: string): Promise<boolean> {
    const row = await this.cache.get(key);
    if (!row) return false;
    if (row.expireAt && row.expireAt < Date.now()) {
      await this.cache.delete(key);
      this.postBroadcast({ type: "delete", key });
      return false;
    }
    return true;
  }

  async delete(key: string) {
    await this.cache.delete(key);
    this.postBroadcast({ type: "delete", key });
  }

  async clear() {
    await this.cache.clear();
    this.postBroadcast({ type: "clear" });
  }

  async keys(): Promise<string[]> {
    return this.cache.toCollection().primaryKeys();
  }

  async stats() {
    const arr = await this.cache.toArray();
    const totalBytes = arr.reduce((s, r) => s + (r.size || 0), 0);
    return {
      count: arr.length,
      totalBytes,
      entries: arr.length,
      protected: arr.filter(r => r.protected).length
    };
  }

  // close DB and timers
  async close() {
    this.isClosed = true;
    if (this.writeTimer) clearTimeout(this.writeTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.bc) this.bc.close();
    await this.db.close();
  }

  // --- Internal / helpers ---

  private async flushWriteQueue() {
    if (this.writeQueue.size === 0) return;
    const batch = Array.from(this.writeQueue.entries());
    this.writeQueue.clear();
    this.writeTimer = null;

    // perform a transaction to put many entries
    await this.db.transaction("rw", this.cache, async () => {
      const now = Date.now();
      for (const [key, { data, opts }] of batch) {
        const size = estimateBytes(data);
        const expireSecs = typeof opts?.defaultTTLSeconds === "number" ? opts.defaultTTLSeconds : this.options.defaultTTLSeconds;
        const rec: CacheRecord = {
          key,
          module: opts?.module,
          data,
          size,
          updatedAt: now,
          protected: !!opts?.protected,
          expireAt: expireSecs > 0 ? now + expireSecs * 1000 : undefined,
        };
        await this.cache.put(rec);
      }
    });

    // enforce global quota after write
    await this.enforceMaxSize();
    // broadcast keys updated
    for (const [key] of batch) this.postBroadcast({ type: "set", key });
  }

  /**
   * ensure total bytes < maxTotalBytes by evicting oldest (LRU)
   * we assume 'updatedAt' updated on read/write (we call update on get)
   */
  private async enforceMaxSize() {
    const target = this.options.maxTotalBytes;
    const rows = await this.cache.orderBy("updatedAt").toArray(); // oldest first
    let total = rows.reduce((s, r) => s + (r.size || 0), 0);
    if (total <= target) return;

    // delete oldest until under target (note: we delete the absolutely oldest)
    for (const r of rows) {
      if (r?.protected) continue; // skip protected entries
      await this.cache.delete(r.key);
      total -= r.size || 0;
      this.postBroadcast({ type: "delete", key: r.key });
      if (total <= target) break;
    }
  }

  /**
   * periodic cleanup: expired entries & space enforcement
   */
  private startCleanupTimer() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = window.setInterval(async () => {
      try {
        await this.cleanExpired();
        await this.enforceMaxSize();
      } catch (e) {
        // swallow
        console.warn("BigCacheDB cleanup error", e);
      }
    }, this.options.cleanupIntervalMs);
  }

  private async cleanExpired() {
    const now = Date.now();
    // await this.cache.where("expireAt").below(now).delete();
    const expired = await this.cache
      .where('expireAt')
      .below(now)
      .toArray();

    for (const item of expired) {
      if (item.protected) continue; // ✅ 保护数据不会因过期而删除
      await this.cache.delete(item.key);
    }
  }

  // BroadcastChannel multi-tab events
  private postBroadcast(msg: any) {
    if (!this.bc) return;
    try {
      this.bc.postMessage(msg);
    } catch (e) {
      // ignore
    }
  }

  private async handleBroadcast(msg: any) {
    // naive: consumers may want to react; we don't auto-change local DB because DB is source of truth
    // But we can optionally emit window events for app to subscribe
    try {
      const ev = new CustomEvent("big-cache-event", { detail: msg });
      window.dispatchEvent(ev);
    } catch (e) {}
  }
}
