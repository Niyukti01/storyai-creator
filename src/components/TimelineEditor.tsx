import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: Dialogue[];
  action: string;
}

interface TimelineEditorProps {
  scenes: Scene[];
  activeSceneNumber?: number;
  onSceneClick: (sceneNumber: number) => void;
  onSceneReorder: (fromIndex: number, toIndex: number) => void;
}

export const TimelineEditor = ({
  scenes,
  activeSceneNumber,
  onSceneClick,
  onSceneReorder,
}: TimelineEditorProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onSceneReorder(draggedIndex, targetIndex);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <Card className="p-4 bg-card/50 backdrop-blur border-2">
      <div className="flex items-center gap-2 mb-3">
        <Film className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Scene Timeline</h3>
        <Badge variant="secondary" className="text-xs">
          {scenes.length} scenes
        </Badge>
      </div>
      
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {scenes.map((scene, index) => (
            <div
              key={scene.scene_number}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => onSceneClick(scene.scene_number)}
              className={cn(
                "relative flex-shrink-0 w-32 cursor-pointer transition-all duration-200",
                draggedIndex === index && "opacity-50",
                dragOverIndex === index && "scale-105"
              )}
            >
              <Card
                className={cn(
                  "p-3 border-2 transition-all hover:shadow-lg hover:border-primary/50",
                  activeSceneNumber === scene.scene_number
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={
                      activeSceneNumber === scene.scene_number
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    Scene {scene.scene_number}
                  </Badge>
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-medium truncate" title={scene.setting}>
                    {scene.setting}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2" title={scene.description}>
                    {scene.description}
                  </p>
                  
                  {scene.dialogue.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                      <span>{scene.dialogue.length}</span>
                      <span>dialogue{scene.dialogue.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </Card>
              
              {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
                <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-primary rounded" />
              )}
              {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
                <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-primary rounded" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
