export type Asset = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
};

export type UploadSlot = { id: string } & (
  | { status: 'empty' }
  | { status: 'uploading'; file: File; preview: string }
  | { status: 'ready'; file: File; preview: string; asset: Asset }
  | { status: 'failed'; file: File; preview: string | null; message: string; retryable: boolean }
);

export type TaskReceipt = {
  id: string;
  templateTitle: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  failure: { message: string } | null;
};

export type Submission =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'accepted'; task: TaskReceipt }
  | { status: 'failed'; message: string; uncertain: boolean };
