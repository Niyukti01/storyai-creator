import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Play, X, ArrowLeftRight, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { VideoThumbnail } from "./VideoThumbnail";

interface VideoVersion {
  id: string;
  project_id: string;
  video_url: string;
  thumbnail_url: string | null;
  version_number: number;
  status: string;
  created_at: string;
  metadata: any;
}

interface VideoGalleryProps {
  projectId: string;
  currentVideoUrl: string | null;
  onSelectVersion?: (videoUrl: string) => void;
}

export const VideoGallery = ({ projectId, currentVideoUrl, onSelectVersion }: VideoGalleryProps) => {
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVideos, setCompareVideos] = useState<[VideoVersion | null, VideoVersion | null]>([null, null]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, projectId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("video_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVersions((data as VideoVersion[]) || []);
    } catch (error: any) {
      console.error("Failed to load video versions:", error);
      toast.error("Failed to load video history");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForCompare = (version: VideoVersion) => {
    if (!compareVideos[0]) {
      setCompareVideos([version, null]);
    } else if (!compareVideos[1]) {
      setCompareVideos([compareVideos[0], version]);
    } else {
      // Reset and start new selection
      setCompareVideos([version, null]);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from("video_versions")
        .delete()
        .eq("id", versionId);

      if (error) throw error;
      
      setVersions(versions.filter(v => v.id !== versionId));
      toast.success("Video version deleted");
    } catch (error: any) {
      console.error("Failed to delete version:", error);
      toast.error("Failed to delete video version");
    }
  };

  const handleUseVersion = (version: VideoVersion) => {
    if (onSelectVersion) {
      onSelectVersion(version.video_url);
      setIsOpen(false);
      toast.success(`Using version ${version.version_number}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Video History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Video Version History
          </DialogTitle>
          <CardDescription>
            View and compare all previously generated videos for this project
          </CardDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareVideos([null, null]);
            }}
            className="gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            {compareMode ? "Exit Compare" : "Compare Versions"}
          </Button>
          {compareMode && (
            <span className="text-sm text-muted-foreground">
              {compareVideos[0] && compareVideos[1]
                ? "Comparing 2 versions"
                : compareVideos[0]
                ? "Select second video"
                : "Select first video"}
            </span>
          )}
        </div>

        {/* Comparison View */}
        {compareMode && compareVideos[0] && compareVideos[1] && (
          <Card className="mb-4 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Side-by-Side Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Badge variant="secondary">Version {compareVideos[0].version_number}</Badge>
                  <video controls className="w-full rounded-lg border">
                    <source src={compareVideos[0].video_url} type="video/mp4" />
                  </video>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(compareVideos[0].created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Badge variant="secondary">Version {compareVideos[1].version_number}</Badge>
                  <video controls className="w-full rounded-lg border">
                    <source src={compareVideos[1].video_url} type="video/mp4" />
                  </video>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(compareVideos[1].created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No video versions yet</p>
              <p className="text-sm">Generate a video to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <Card
                  key={version.id}
                  className={`transition-all ${
                    compareMode
                      ? "cursor-pointer hover:border-primary"
                      : ""
                  } ${
                    (compareVideos[0]?.id === version.id || compareVideos[1]?.id === version.id)
                      ? "border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                  onClick={() => compareMode && handleSelectForCompare(version)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-32 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {version.thumbnail_url ? (
                          <img
                            src={version.thumbnail_url}
                            alt={`Version ${version.version_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={index === 0 ? "default" : "secondary"}>
                            Version {version.version_number}
                          </Badge>
                          {index === 0 && (
                            <Badge variant="outline" className="text-xs">Latest</Badge>
                          )}
                          {version.video_url === currentVideoUrl && (
                            <Badge variant="outline" className="text-xs text-green-600">Current</Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(version.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                        
                        {!compareMode && (
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1">
                                  <Play className="h-3 w-3" />
                                  Preview
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>Version {version.version_number}</DialogTitle>
                                </DialogHeader>
                                <video controls autoPlay className="w-full rounded-lg">
                                  <source src={version.video_url} type="video/mp4" />
                                </video>
                              </DialogContent>
                            </Dialog>
                            
                            {onSelectVersion && version.video_url !== currentVideoUrl && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleUseVersion(version)}
                              >
                                Use This Version
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVersion(version.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
