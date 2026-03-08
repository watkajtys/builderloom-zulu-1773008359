import PocketBase from 'pocketbase';
import type { SystemStatus } from './types';

// Use window.location.hostname for browser context, fallback to localhost for tests
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8090`;
  }
  return 'http://loom-pocketbase:8090'; // Use Docker network hostname for SSR/tests
};

export const pb = new PocketBase(getApiUrl());

export class BaseService {
  constructor(protected collectionName: string) {}

  async getById(id: string) {
    return pb.collection(this.collectionName).getOne(id);
  }

  async getAll() {
    return pb.collection(this.collectionName).getFullList();
  }
}

export class SystemService extends BaseService {
  constructor() {
    super('system_status');
  }

  async getStatus(): Promise<SystemStatus> {
    try {
      // For now, we'll try to fetch the latest status or return a default
      const records = await pb.collection(this.collectionName).getList<SystemStatus>(1, 1, {
        sort: '-created',
      });
      
      if (records.items.length > 0) {
        return records.items[0];
      }
      
      return {
        id: 'default',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        status: 'online',
        version: '1.0.0',
        active_modules: ['core', 'auth']
      };
    } catch (e) {
      console.warn('System status check failed, returning default:', e);
      return {
        id: 'default',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        status: 'offline',
        version: 'unknown',
        active_modules: []
      };
    }
  }
}

export const systemService = new SystemService();
