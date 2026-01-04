import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2, Clock, Edit2, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Annotation {
  id: string;
  timestamp_seconds: number;
  content: string;
  created_at: string;
  user_id: string;
}

interface VideoAnnotationsProps {
  projectId: string;
  videoUrl: string;
  videoVersionId?: string;
}

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VideoAnnotations = ({ projectId, videoUrl, videoVersionId }: VideoAnnotationsProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [newTimestamp, setNewTimestamp] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadAnnotations();
  }, [projectId, videoVersionId]);

  const loadAnnotations = async () => {
    try {
      let query = supabase
        .from("video_annotations")
        .select("*")
        .eq("project_id", projectId)
        .order("timestamp_seconds", { ascending: true });

      if (videoVersionId) {
        query = query.eq("video_version_id", videoVersionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAnnotations(data || []);
    } catch (error) {
      console.error("Failed to load annotations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!newContent.trim()) {
      toast.error("Please enter annotation content");
      return;
    }

    const [mins, secs] = newTimestamp.split(":").map(Number);
    const timestampSeconds = (mins || 0) * 60 + (secs || 0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase.from("video_annotations").insert({
        project_id: projectId,
        video_version_id: videoVersionId || null,
        user_id: user.id,
        timestamp_seconds: timestampSeconds,
        content: newContent.trim(),
      });

      if (error) throw error;

      toast.success("Annotation added");
      setNewContent("");
      setNewTimestamp("");
      setIsAdding(false);
      loadAnnotations();
    } catch (error: any) {
      toast.error(error.message || "Failed to add annotation");
    }
  };

  const handleUpdateAnnotation = async (id: string) => {
    if (!editContent.trim()) return;

    try {
      const { error } = await supabase
        .from("video_annotations")
        .update({ content: editContent.trim() })
        .eq("id", id);

      if (error) throw error;

      toast.success("Annotation updated");
      setEditingId(null);
      setEditContent("");
      loadAnnotations();
    } catch (error: any) {
      toast.error(error.message || "Failed to update annotation");
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      const { error } = await supabase
        .from("video_annotations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Annotation deleted");
      loadAnnotations();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete annotation");
    }
  };

  const seekToTimestamp = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const getCurrentTimestamp = () => {
    if (videoRef.current) {
      const currentTime = Math.floor(videoRef.current.currentTime);
      setNewTimestamp(formatTimestamp(currentTime));
    }
  };

  return (
    <Card className="shadow-[var(--shadow-medium)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Video Annotations
          </CardTitle>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden video reference for seeking */}
        <video ref={videoRef} src={videoUrl} className="hidden" />

        {/* Add new annotation form */}
        {isAdding && (
          <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Timestamp (mm:ss)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="0:00"
                    value={newTimestamp}
                    onChange={(e) => setNewTimestamp(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={getCurrentTimestamp}
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Current
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Note</label>
              <Textarea
                placeholder="Add your note about this moment..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddAnnotation} size="sm">
                <Check className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsAdding(false);
                  setNewContent("");
                  setNewTimestamp("");
                }}
                size="sm"
                variant="outline"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Annotations list */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading annotations...</div>
        ) : annotations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No annotations yet</p>
            <p className="text-sm">Add timestamped notes to mark important moments</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="p-3 border border-border rounded-lg bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors mb-2"
                        onClick={() => seekToTimestamp(Number(annotation.timestamp_seconds))}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimestamp(Number(annotation.timestamp_seconds))}
                      </Badge>
                      {editingId === annotation.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleUpdateAnnotation(annotation.id)}
                              size="sm"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingId(null);
                                setEditContent("");
                              }}
                              size="sm"
                              variant="outline"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm">{annotation.content}</p>
                      )}
                    </div>
                    {editingId !== annotation.id && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingId(annotation.id);
                            setEditContent(annotation.content);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAnnotation(annotation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
