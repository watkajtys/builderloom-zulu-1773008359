export interface BaseModel {
  id: string;
  created: string;
  updated: string;
}

export interface SystemStatus extends BaseModel {
  status: 'online' | 'offline' | 'degraded';
  version: string;
  active_modules: string[];
}

export interface ApiError {
  code: number;
  message: string;
  data: Record<string, any>;
}
