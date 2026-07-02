import { SavedAsset } from "@/types/document-signer";

const ASSETS_STORAGE_KEY = "signer-assets";

export const getSavedAssets = (): SavedAsset[] => {
  try {
    const stored = localStorage.getItem(ASSETS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveAsset = (asset: Omit<SavedAsset, 'id' | 'createdAt'>): SavedAsset => {
  const assets = getSavedAssets();
  const newAsset: SavedAsset = {
    ...asset,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  assets.push(newAsset);
  localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
  return newAsset;
};

export const deleteAsset = (id: string): void => {
  const assets = getSavedAssets().filter(a => a.id !== id);
  localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
};
