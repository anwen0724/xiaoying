export type Template = {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  description: string;
  coverUrl: string;
  requiredImageCount: number;
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
};

export type Category = { code: string; name: string };
