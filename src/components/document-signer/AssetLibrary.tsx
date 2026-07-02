import { useState, useEffect, type ReactNode } from "react";
import { SavedAsset } from "@/types/document-signer";
import { getSavedAssets, deleteAsset } from "@/utils/signer-storage";
import { Trash2 } from "lucide-react";
import signatureImg from "@/assets/signature.png";
import stampImg from "@/assets/company-stamp.png";

interface AssetLibraryProps {
  type: 'signature' | 'stamp';
  onSelect: (asset: SavedAsset) => void;
  addButton: ReactNode;
  refreshKey?: number;
}

// Default assets from the project
const DEFAULT_SIGNATURE: SavedAsset = {
  id: 'default-signature',
  name: 'Company Signature',
  imageData: signatureImg.src,
  type: 'signature',
  createdAt: new Date().toISOString(),
};

const DEFAULT_STAMP: SavedAsset = {
  id: 'default-stamp',
  name: 'Company Stamp',
  imageData: stampImg.src,
  type: 'stamp',
  createdAt: new Date().toISOString(),
};

const checkerboardStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
  backgroundColor: "#fff",
};

export const AssetLibrary = ({ type, onSelect, addButton, refreshKey }: AssetLibraryProps) => {
  const [assets, setAssets] = useState<SavedAsset[]>([]);

  useEffect(() => {
    const savedAssets = getSavedAssets().filter(a => a.type === type);
    // Add default asset at the beginning
    const defaultAsset = type === 'stamp' ? DEFAULT_STAMP : DEFAULT_SIGNATURE;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount/refreshKey change, not derived from props/state
    setAssets([defaultAsset, ...savedAssets]);
  }, [type, refreshKey]);

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't allow deleting default assets
    if (id === 'default-signature' || id === 'default-stamp') return;
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    deleteAsset(id);
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-2">
      {addButton}

      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="relative group border rounded-lg p-2 cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
            style={checkerboardStyle}
            onClick={() => onSelect(asset)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.imageData}
              alt={asset.name}
              className="w-full h-14 object-contain"
            />
            {asset.id !== 'default-signature' && asset.id !== 'default-stamp' && (
              <button
                onClick={(e) => handleDelete(asset.id, asset.name, e)}
                aria-label={`Delete ${asset.name}`}
                className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <p className="text-[10px] text-muted-foreground truncate text-center mt-1 bg-background/80 rounded px-1">
              {asset.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
