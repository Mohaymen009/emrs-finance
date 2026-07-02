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

function pointFromEvent(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ("touches" in e) {
    const t = e.touches[0] ?? e.changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return { x: e.clientX, y: e.clientY };
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
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const { x: clientX, y: clientY } = pointFromEvent(e);

      if (isDragging) {
        const deltaX = (clientX - dragStart.x) / scale;
        const deltaY = (clientY - dragStart.y) / scale;

        const newX = Math.max(0, Math.min(element.x + deltaX, (containerRect.width / scale) - element.width));
        const newY = Math.max(0, Math.min(element.y + deltaY, (containerRect.height / scale) - element.height));

        onUpdate(element.id, { x: newX, y: newY });
        setDragStart({ x: clientX, y: clientY });
      }

      if (isResizing) {
        const deltaX = (clientX - dragStart.x) / scale;
        const deltaY = (clientY - dragStart.y) / scale;

        const aspectRatio = element.width / element.height;
        const newWidth = Math.max(40, element.width + deltaX);
        const newHeight = newWidth / aspectRatio;

        onUpdate(element.id, { width: newWidth, height: newHeight });
        setDragStart({ x: clientX, y: clientY });
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, isResizing, dragStart, element, onUpdate, scale, containerRef]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    const { x, y } = pointFromEvent(e.nativeEvent);
    setDragStart({ x, y });
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    const { x, y } = pointFromEvent(e.nativeEvent);
    setDragStart({ x, y });
  };

  return (
    <div
      ref={elementRef}
      className={`absolute cursor-move group touch-none ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
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
      onTouchStart={handleDragStart}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
            aria-label="Delete"
          >
            <X className="h-3 w-3" />
          </button>

          {/* Move indicator */}
          <div className="absolute -top-2 -left-2 p-1 bg-primary text-primary-foreground rounded-full shadow-md">
            <Move className="h-3 w-3" />
          </div>

          {/* Resize handle */}
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full cursor-se-resize shadow-md touch-none"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />
        </>
      )}
    </div>
  );
};
