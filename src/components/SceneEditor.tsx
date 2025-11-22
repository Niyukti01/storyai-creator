import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, GripVertical, Camera, MessageSquare } from "lucide-react";
import { toast } from "sonner";

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

interface SceneEditorProps {
  scene: Scene;
  onSave: (scene: Scene) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const cameraAngles = [
  "Wide Shot",
  "Medium Shot",
  "Close-Up",
  "Extreme Close-Up",
  "Over-the-Shoulder",
  "Bird's Eye View",
  "Low Angle",
  "High Angle",
  "Dutch Angle",
  "POV (Point of View)",
];

const emotions = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "excited",
  "scared",
  "surprised",
  "confused",
  "thoughtful",
  "determined",
];

export function SceneEditor({
  scene,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SceneEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScene, setEditedScene] = useState<Scene>(scene);

  const handleSave = () => {
    onSave(editedScene);
    setIsEditing(false);
    toast.success("Scene updated successfully");
  };

  const handleCancel = () => {
    setEditedScene(scene);
    setIsEditing(false);
  };

  const addDialogue = () => {
    setEditedScene({
      ...editedScene,
      dialogue: [
        ...editedScene.dialogue,
        { character: "", line: "", emotion: "neutral" },
      ],
    });
  };

  const updateDialogue = (index: number, field: keyof Dialogue, value: string) => {
    const newDialogue = [...editedScene.dialogue];
    newDialogue[index] = { ...newDialogue[index], [field]: value };
    setEditedScene({ ...editedScene, dialogue: newDialogue });
  };

  const removeDialogue = (index: number) => {
    const newDialogue = editedScene.dialogue.filter((_, i) => i !== index);
    setEditedScene({ ...editedScene, dialogue: newDialogue });
  };

  return (
    <>
      <Card className="border-2 hover:border-primary/50 transition-colors shadow-lg">
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                {!isFirst && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onMoveUp}
                  >
                    <GripVertical className="h-4 w-4" />
                  </Button>
                )}
                {!isLast && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onMoveDown}
                  >
                    <GripVertical className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                {scene.scene_number}
              </div>
              <div>
                <h3 className="text-lg font-semibold">Scene {scene.scene_number}</h3>
                <p className="text-sm text-muted-foreground">{scene.setting}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scene.camera_angle && (
                <Badge variant="outline" className="gap-2">
                  <Camera className="h-3 w-3" />
                  {scene.camera_angle}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
            <p className="text-foreground">{scene.description}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Action</h4>
            <p className="text-foreground">{scene.action}</p>
          </div>

          {scene.dialogue && scene.dialogue.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Dialogue
              </h4>
              <div className="space-y-2">
                {scene.dialogue.map((line, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/50 rounded-lg p-3 border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {line.character.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{line.character}</span>
                          <Badge variant="secondary" className="text-xs">
                            {line.emotion}
                          </Badge>
                        </div>
                        <p className="text-foreground italic">"{line.line}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scene {scene.scene_number}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="setting">Setting</Label>
              <Input
                id="setting"
                value={editedScene.setting}
                onChange={(e) =>
                  setEditedScene({ ...editedScene, setting: e.target.value })
                }
                placeholder="e.g., A dark forest at night"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="camera">Camera Angle</Label>
              <Select
                value={editedScene.camera_angle || ""}
                onValueChange={(value) =>
                  setEditedScene({ ...editedScene, camera_angle: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select camera angle" />
                </SelectTrigger>
                <SelectContent>
                  {cameraAngles.map((angle) => (
                    <SelectItem key={angle} value={angle}>
                      {angle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedScene.description}
                onChange={(e) =>
                  setEditedScene({ ...editedScene, description: e.target.value })
                }
                placeholder="Describe what's happening in the scene"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Textarea
                id="action"
                value={editedScene.action}
                onChange={(e) =>
                  setEditedScene({ ...editedScene, action: e.target.value })
                }
                placeholder="Describe the actions taking place"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dialogue</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDialogue}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dialogue
                </Button>
              </div>

              {editedScene.dialogue.map((line, idx) => (
                <Card key={idx} className="p-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`character-${idx}`}>Character</Label>
                        <Input
                          id={`character-${idx}`}
                          value={line.character}
                          onChange={(e) =>
                            updateDialogue(idx, "character", e.target.value)
                          }
                          placeholder="Character name"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`emotion-${idx}`}>Emotion</Label>
                        <Select
                          value={line.emotion}
                          onValueChange={(value) =>
                            updateDialogue(idx, "emotion", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {emotions.map((emotion) => (
                              <SelectItem key={emotion} value={emotion}>
                                {emotion}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDialogue(idx)}
                        className="mt-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`line-${idx}`}>Line</Label>
                      <Textarea
                        id={`line-${idx}`}
                        value={line.line}
                        onChange={(e) =>
                          updateDialogue(idx, "line", e.target.value)
                        }
                        placeholder="What does the character say?"
                        rows={2}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
