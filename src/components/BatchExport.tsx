import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Download, Package, FileVideo, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface VideoVersion {
  id: string;
  version_number: number;
  video_url: string;
  created_at: string;
  project_id?: string;
  status?: string;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  metadata?: any;
  thumbnail_url?: string | null;
}

interface Scene {
  scene_number: number;
  setting: string;
}

interface BatchExportProps {
  projectId: string;
  projectTitle: string;
  currentVideoUrl?: string;
  scenes?: Scene[];
}

export const BatchExport = ({ 
  projectId, 
  projectTitle, 
  currentVideoUrl,
  scenes = []
}: BatchExportProps) => {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, projectId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("video_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      
      // Add current video if not in versions
      const versionsList: VideoVersion[] = data || [];
      if (currentVideoUrl && !versionsList.some(v => v.video_url === currentVideoUrl)) {
        versionsList.unshift({
          id: "current",
          version_number: versionsList.length + 1,
          video_url: currentVideoUrl,
          created_at: new Date().toISOString(),
        } as VideoVersion);
      }
      
      setVersions(versionsList);
    } catch (error) {
      console.error("Failed to load versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVersion = (id: string) => {
    const newSelected = new Set(selectedVersions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVersions(newSelected);
  };

  const selectAll = () => {
    if (selectedVersions.size === versions.length) {
      setSelectedVersions(new Set());
    } else {
      setSelectedVersions(new Set(versions.map(v => v.id)));
    }
  };

  const exportSelected = async () => {
    if (selectedVersions.size === 0) {
      toast.error("Please select at least one video to export");
      return;
    }

    setExporting(true);
    setProgress(0);
    
    try {
      const zip = new JSZip();
      const videosToExport = versions.filter(v => selectedVersions.has(v.id));
      const total = videosToExport.length;
      
      for (let i = 0; i < videosToExport.length; i++) {
        const version = videosToExport[i];
        setExportStatus(`Downloading video ${i + 1} of ${total}...`);
        
        try {
          const response = await fetch(version.video_url);
          if (!response.ok) throw new Error(`Failed to fetch video ${version.version_number}`);
          
          const blob = await response.blob();
          const fileName = `${projectTitle.replace(/[^a-z0-9]/gi, '_')}_v${version.version_number}.mp4`;
          zip.file(fileName, blob);
          
          setProgress(((i + 1) / total) * 80);
        } catch (err) {
          console.error(`Failed to download version ${version.version_number}:`, err);
          toast.error(`Failed to download version ${version.version_number}`);
        }
      }

      setExportStatus("Creating ZIP file...");
      setProgress(90);
      
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      }, (metadata) => {
        setProgress(90 + (metadata.percent / 10));
      });

      setExportStatus("Downloading...");
      setProgress(100);
      
      const zipFileName = `${projectTitle.replace(/[^a-z0-9]/gi, '_')}_videos.zip`;
      saveAs(zipBlob, zipFileName);
      
      toast.success(`Exported ${selectedVersions.size} video(s) successfully`);
      setOpen(false);
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error(error.message || "Failed to export videos");
    } finally {
      setExporting(false);
      setProgress(0);
      setExportStatus("");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Package className="w-5 h-5 mr-2" />
          Batch Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Batch Export Videos
          </DialogTitle>
          <DialogDescription>
            Select video versions to download as a ZIP file
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
              Loading videos...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileVideo className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No videos available to export</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  {selectedVersions.size} of {versions.length} selected
                </Label>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedVersions.size === versions.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <ScrollArea className="h-[250px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedVersions.has(version.id) 
                          ? 'bg-primary/5 border-primary' 
                          : 'bg-background border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleVersion(version.id)}
                    >
                      <Checkbox
                        checked={selectedVersions.has(version.id)}
                        onCheckedChange={() => toggleVersion(version.id)}
                      />
                      <FileVideo className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          Version {version.version_number}
                          {version.id === "current" && (
                            <span className="ml-2 text-xs text-primary">(Current)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(version.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
          
          {exporting && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">{exportStatus}</p>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button 
              onClick={exportSelected} 
              disabled={exporting || selectedVersions.size === 0}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {selectedVersions.size > 0 ? `(${selectedVersions.size})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
