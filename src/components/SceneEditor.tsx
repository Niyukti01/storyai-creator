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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Pencil, Trash2, Plus, GripVertical, Camera, MessageSquare, Copy, StickyNote, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface SceneNote {
  id: string;
  text: string;
  type: "production" | "reminder" | "comment";
  createdAt: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: Dialogue[];
  action: string;
  notes?: SceneNote[];
}

interface SceneEditorProps {
  scene: Scene;
  onSave: (scene: Scene) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
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

const noteTypes = [
  { value: "production", label: "Production", color: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
  { value: "reminder", label: "Reminder", color: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
  { value: "comment", label: "Comment", color: "bg-green-500/20 text-green-600 border-green-500/30" },
] as const;

export function SceneEditor({
  scene,
  onSave,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SceneEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScene, setEditedScene] = useState<Scene>(scene);
  const [notesOpen, setNotesOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState<"production" | "reminder" | "comment">("comment");

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

  const addNote = () => {
    if (!newNoteText.trim()) return;
    
    const newNote: SceneNote = {
      id: crypto.randomUUID(),
      text: newNoteText.trim(),
      type: newNoteType,
      createdAt: new Date().toISOString(),
    };
    
    const updatedScene = {
      ...scene,
      notes: [...(scene.notes || []), newNote],
    };
    
    onSave(updatedScene);
    setNewNoteText("");
    toast.success("Note added successfully");
  };

  const removeNote = (noteId: string) => {
    const updatedScene = {
      ...scene,
      notes: (scene.notes || []).filter((n) => n.id !== noteId),
    };
    onSave(updatedScene);
    toast.success("Note removed");
  };

  const getNoteTypeStyle = (type: string) => {
    return noteTypes.find((t) => t.value === type)?.color || noteTypes[2].color;
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
                title="Edit scene"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDuplicate}
                  title="Duplicate scene"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                  title="Delete scene"
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

          {/* Scene Notes Section */}
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-amber-500" />
                  Production Notes
                  {scene.notes && scene.notes.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {scene.notes.length}
                    </Badge>
                  )}
                </h4>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${notesOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Existing Notes */}
              {scene.notes && scene.notes.length > 0 && (
                <div className="space-y-2">
                  {scene.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-lg p-3 border ${getNoteTypeStyle(note.type)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {note.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm">{note.text}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeNote(note.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Note */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex gap-2">
                  <Select
                    value={newNoteType}
                    onValueChange={(v) => setNewNoteType(v as typeof newNoteType)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {noteTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add a production note, reminder, or comment..."
                    className="flex-1 min-h-[60px]"
                    rows={2}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={addNote}
                  disabled={!newNoteText.trim()}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
