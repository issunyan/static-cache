import { Store, get, set, keys } from 'idb-keyval';

const createStore = (dbName, storeName) => new Store(dbName, storeName);

let defaultStore;

const getDefaultStore = () => {
  if (!defaultStore) {
    defaultStore = createStore('asset-db', 'asset-store');
  }
  return defaultStore;
};

const blobRequest = async (input) => {
  const response = await window.fetch(input);
  if (response.status === 200) {
    const blob = await response.blob();
    return blob;
  }
  return Promise.reject(new Error('下载失败'));
};

const url2blob = async (assetURLs) => {
  const source = await Promise.all(
    assetURLs.map((URL) =>
      blobRequest(URL).then((res) => ({
        key: URL,
        value: res,
      })),
    ),
  );
  return source;
};

const privateCacheAction = async (assetURLs, store) => {
  const storageItems = await url2blob(assetURLs);

  const results = await Promise.all(
    storageItems.map((item) =>
      set(item.key, item.value, store).then(() => item.key),
    ),
  );

  return results;
};

class CacheAsset {
  constructor(store, IDBKeys) {
    this.store = store;
    this.IDBKeys = IDBKeys;
    this.cache = {};
  }

  static async build(store) {
    const curStore = store || getDefaultStore();
    const IDBKeys = await keys(curStore);
    return new CacheAsset(curStore, IDBKeys);
  }

  async getCacheURL(key) {
    if (this.cache[key]) {
      return this.cache[key];
    }
    if (this.IDBKeys.includes(key)) {
      const IDBvalue = await get(key, this.store);
      const result =
        IDBvalue instanceof Blob ? window.URL.createObjectURL(IDBvalue) : '';
      if (result) {
        this.cache[key] = result;
      }
      return result;
    }
    return '';
  }

  async manualCache(assetURLs) {
    const uncachedURLs = assetURLs.reduce((acc, cur) => {
      if (!this.IDBKeys.includes(cur)) {
        acc.push(cur);
      }
      return acc;
    }, []);
    if (uncachedURLs.length) {
      const results = await privateCacheAction(uncachedURLs, this.store);
      this.IDBKeys.push(...results);
    }
  }

  revokeOne(url) {
    if (this.cache[url]) {
      window.URL.revokeObjectURL(this.cache[url]);
    }
  }

  destroy() {
    Object.values(this.cache).forEach(window.URL.revokeObjectURL);
  }
}

export default CacheAsset;
