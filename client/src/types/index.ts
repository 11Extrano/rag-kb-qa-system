export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface DocumentItem {
  doc_id: string;
  filename: string;
  status: 'uploaded' | 'cleaning' | 'cleaned' | 'splitting' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface QaCitation {
  chunkId: string;
  docId: string;
  text: string;
  score: number;
  filename: string;
}

export interface QaResult {
  question: string;
  answer: string;
  citations: QaCitation[];
}
