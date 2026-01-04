import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Layers, Play, RefreshCw, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface Chapter {
  id: string;
  scene_number: number;
  title: string;
  start_seconds: number;
  end_seconds: number | null;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
}

interface VideoChaptersProps {
  projectId: string;
  videoUrl: string;
  scenes: Scene[];
  videoDuration?: number;
  onSeek?: (seconds: number) => void;
}

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VideoChapters = ({ 
  projectId, 
  videoUrl, 
  scenes, 
  videoDuration,
  onSeek 
}: VideoChaptersProps) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadChapters();
  }, [projectId]);

  useEffect(() => {
    // Get video duration when loaded
    const video = videoRef.current;
    if (video) {
      const handleTimeUpdate = () => {
        const currentTime = video.currentTime;
        const active = chapters.find(ch => 
          currentTime >= ch.start_seconds && 
          (ch.end_seconds === null || currentTime < ch.end_seconds)
        );
        setCurrentChapter(active?.id || null);
      };
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [chapters]);

  const loadChapters = async () => {
    try {
      const { data, error } = await supabase
        .from("video_chapters")
        .select("*")
        .eq("project_id", projectId)
        .order("scene_number", { ascending: true });

      if (error) throw error;
      setChapters(data || []);
    } catch (error) {
      console.error("Failed to load chapters:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateChaptersFromScenes = async () => {
    if (!scenes || scenes.length === 0) {
      toast.error("No scenes available to generate chapters");
      return;
    }

    setGenerating(true);
    try {
      // Get video duration
      const video = videoRef.current;
      let duration = videoDuration || 60;
      
      if (video) {
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            duration = video.duration;
            resolve();
          } else {
            video.onloadedmetadata = () => {
              duration = video.duration;
              resolve();
            };
          }
        });
      }

      // Calculate approximate chapter durations based on scene count
      const sceneDuration = duration / scenes.length;

      // Delete existing chapters
      await supabase
        .from("video_chapters")
        .delete()
        .eq("project_id", projectId);

      // Create chapters from scenes
      const newChapters = scenes.map((scene, index) => ({
        project_id: projectId,
        scene_number: scene.scene_number,
        title: scene.setting,
        start_seconds: index * sceneDuration,
        end_seconds: index < scenes.length - 1 ? (index + 1) * sceneDuration : duration,
      }));

      const { error } = await supabase
        .from("video_chapters")
        .insert(newChapters);

      if (error) throw error;

      toast.success(`Generated ${scenes.length} chapters from scenes`);
      loadChapters();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate chapters");
    } finally {
      setGenerating(false);
    }
  };

  const seekToChapter = (seconds: number) => {
    if (onSeek) {
      onSeek(seconds);
    } else if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const getChapterProgress = (chapter: Chapter): number => {
    if (!videoRef.current) return 0;
    const currentTime = videoRef.current.currentTime;
    const start = chapter.start_seconds;
    const end = chapter.end_seconds || videoRef.current.duration;
    
    if (currentTime < start) return 0;
    if (currentTime >= end) return 100;
    return ((currentTime - start) / (end - start)) * 100;
  };

  return (
    <Card className="shadow-[var(--shadow-medium)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Video Chapters
          </CardTitle>
          <Button 
            onClick={generateChaptersFromScenes} 
            size="sm" 
            variant="outline"
            disabled={generating || !scenes || scenes.length === 0}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {chapters.length > 0 ? 'Regenerate' : 'Generate'} from Scenes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Hidden video for duration/seeking */}
        <video ref={videoRef} src={videoUrl} className="hidden" preload="metadata" />

        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading chapters...</div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No chapters yet</p>
            <p className="text-sm">Generate chapters from your script's scenes</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2 pr-4">
              {chapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  onClick={() => seekToChapter(chapter.start_seconds)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                    currentChapter === chapter.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{chapter.title}</h4>
                        {currentChapter === chapter.id && (
                          <Badge variant="secondary" className="text-xs">
                            <Play className="w-3 h-3 mr-1" />
                            Playing
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(chapter.start_seconds)}</span>
                        {chapter.end_seconds && (
                          <>
                            <span>-</span>
                            <span>{formatTimestamp(chapter.end_seconds)}</span>
                          </>
                        )}
                      </div>
                      {currentChapter === chapter.id && (
                        <Progress 
                          value={getChapterProgress(chapter)} 
                          className="h-1 mt-2" 
                        />
                      )}
                    </div>
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
