export interface AIChatRequest {
  message: string;
  sessionId: string;
  entityId: string;
  entityType: 'tournament' | 'league';
  entityName: string;
  activeFilters?: Record<string, string>;
}

export interface AIChatResponse {
  success: boolean;
  type?: 'text' | 'table' | 'raw';
  reply?: string;
  reportTitle?: string;
  summary?: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  html?: string;
  total?: number;
  error?: string;
}
