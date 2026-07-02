import { useState, useRef, useEffect } from "react";
import { SignerElement } from "@/types/document-signer";
import { X, Move } from "lucide-react";

interface DraggableElementProps {
  element: SignerElement;
  containerRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  onUpdate: (id: string, updates: Partial<SignerElement>) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: () => void;
}

export const DraggableElement = ({
  element,
  containerRef,
  scale,
  onUpdate,
  onDelete,
  isSelected,
  onSelect,
}: DraggableElementProps) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDragging) {
        const deltaX = (e.clientX - dragStart.x) / scale;
        const deltaY = (e.clientY - dragStart.y) / scale;

        const newX = Math.max(0, Math.min(element.x + deltaX, (containerRect.width / scale) - element.width));
        const newY = Math.max(0, Math.min(element.y + deltaY, (containerRect.height / scale) - element.height));

        onUpdate(element.id, { x: newX, y: newY });
        setDragStart({ x: e.clientX, y: e.clientY });
      }

      if (isResizing) {
        const deltaX = (e.clientX - dragStart.x) / scale;
        const deltaY = (e.clientY - dragStart.y) / scale;

        const aspectRatio = element.width / element.height;
        const newWidth = Math.max(40, element.width + deltaX);
        const newHeight = newWidth / aspectRatio;

        onUpdate(element.id, { width: newWidth, height: newHeight });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, element, onUpdate, scale, containerRef]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      ref={elementRef}
      className={`absolute cursor-move group ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      style={{
        left: element.x * scale,
        top: element.y * scale,
        width: element.width * scale,
        height: element.height * scale,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={handleDragStart}
    >
      <img
        src={element.imageData}
        alt={element.type}
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {isSelected && (
        <>
          {/* Delete button */}
          <button
            className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md z-10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>

          {/* Move indicator */}
          <div className="absolute -top-2 -left-2 p-1 bg-primary text-primary-foreground rounded-full shadow-md">
            <Move className="h-3 w-3" />
          </div>

          {/* Resize handle */}
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full cursor-se-resize shadow-md"
            onMouseDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
};
