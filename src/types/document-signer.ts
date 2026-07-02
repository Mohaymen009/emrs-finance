export interface SignerElement {
  id: string;
  type: 'signature' | 'stamp';
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  imageData: string;
}

export interface SavedAsset {
  id: string;
  name: string;
  imageData: string;
  type: 'signature' | 'stamp';
  createdAt: string;
}
