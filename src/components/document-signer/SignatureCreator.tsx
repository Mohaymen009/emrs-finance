import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eraser } from "lucide-react";

interface SignatureCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string, name: string) => void;
}

const TYPE_FONTS = [
  { label: "Elegant", family: "'Brush Script MT', 'Segoe Script', cursive" },
  { label: "Handwritten", family: "'Lucida Handwriting', 'Comic Sans MS', cursive" },
  { label: "Formal", family: "'Segoe Script', 'Brush Script MT', cursive" },
];

const checkerboardStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
  backgroundColor: "#fff",
};

function DrawTab({ onReady }: { onReady: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = "touches" in e ? e.touches[0] : e;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    onReady(canvasRef.current!.toDataURL("image/png"));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onReady(null);
  };

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden" style={checkerboardStyle}>
        <canvas
          ref={canvasRef}
          width={440}
          height={160}
          className="w-full cursor-crosshair touch-none"
          style={{ backgroundColor: "transparent" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={() => setIsDrawing(false)}
          onMouseLeave={() => setIsDrawing(false)}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={() => setIsDrawing(false)}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Draw with your mouse, finger, or stylus.</p>
        <Button type="button" variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
          <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      </div>
    </div>
  );
}

function TypeTab({ onReady }: { onReady: (dataUrl: string | null) => void }) {
  const [text, setText] = useState("");
  const [fontIndex, setFontIndex] = useState(0);

  useEffect(() => {
    if (!text.trim()) {
      onReady(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `56px ${TYPE_FONTS[fontIndex].family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.trim(), canvas.width / 2, canvas.height / 2);
    onReady(canvas.toDataURL("image/png"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, fontIndex]);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="signature-type-input">Type your name</Label>
        <Input
          id="signature-type-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. John Doe"
          className="mt-1"
        />
      </div>
      <div className="flex gap-2">
        {TYPE_FONTS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFontIndex(i)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              i === fontIndex ? "border-primary bg-accent text-accent-foreground" : "border-input hover:bg-accent/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="border rounded-lg h-24 flex items-center justify-center overflow-hidden" style={checkerboardStyle}>
        {text.trim() ? (
          <span style={{ fontFamily: TYPE_FONTS[fontIndex].family, fontSize: 36, color: "#1a1a1a" }}>{text}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Preview appears here</span>
        )}
      </div>
    </div>
  );
}

function UploadTab({ onReady }: { onReady: (dataUrl: string | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreview(dataUrl);
      onReady(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="signature-upload-input">Select an image file (PNG recommended for transparency)</Label>
        <Input id="signature-upload-input" type="file" accept="image/*" onChange={handleFile} className="mt-1" />
      </div>
      {preview && (
        <div className="border rounded-lg h-24 flex items-center justify-center overflow-hidden" style={checkerboardStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Signature preview" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

/**
 * Replaces the old draw-only signature dialog with three ways to create a
 * signature — draw it, type it in a handwriting-style font, or upload an
 * existing image — matching what most e-signature tools offer.
 */
export const SignatureCreator = ({ open, onOpenChange, onSave }: SignatureCreatorProps) => {
  const [tab, setTab] = useState("draw");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local state when the dialog closes, not derived from render
    if (!open) setPending(null);
  }, [open]);

  const handleSave = () => {
    if (!pending) return;
    onSave(pending, `Signature ${new Date().toLocaleDateString()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a signature</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setPending(null); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw">Draw</TabsTrigger>
            <TabsTrigger value="type">Type</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="draw" className="pt-3">
            <DrawTab onReady={setPending} />
          </TabsContent>
          <TabsContent value="type" className="pt-3">
            <TypeTab onReady={setPending} />
          </TabsContent>
          <TabsContent value="upload" className="pt-3">
            <UploadTab onReady={setPending} />
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!pending}>
            Save signature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
