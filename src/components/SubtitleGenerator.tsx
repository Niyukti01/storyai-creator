import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Subtitles, Download, Eye, Settings2, Type, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  dialogue: Dialogue[];
  action: string;
}

interface SubtitleSettings {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  position: "top" | "center" | "bottom";
  showCharacterName: boolean;
  showEmotion: boolean;
}

interface TimedSubtitle {
  id: string;
  sceneNumber: number;
  character: string;
  text: string;
  emotion: string;
  startTime: number;
  endTime: number;
}

interface SubtitleGeneratorProps {
  projectId: string;
  scenes: Scene[];
  onSubtitlesGenerated?: (subtitles: TimedSubtitle[]) => void;
}

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter (Modern)" },
  { value: "Roboto", label: "Roboto (Clean)" },
  { value: "Georgia", label: "Georgia (Elegant)" },
  { value: "Courier New", label: "Courier New (Typewriter)" },
  { value: "Comic Sans MS", label: "Comic Sans (Playful)" },
  { value: "Arial", label: "Arial (Classic)" },
];

const POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

const COLOR_PRESETS = [
  { name: "White", value: "#FFFFFF" },
  { name: "Yellow", value: "#FFFF00" },
  { name: "Cyan", value: "#00FFFF" },
  { name: "Green", value: "#00FF00" },
];

const BG_PRESETS = [
  { name: "Black", value: "#000000" },
  { name: "Dark Blue", value: "#1a1a2e" },
  { name: "Dark Gray", value: "#2d2d2d" },
  { name: "Transparent", value: "transparent" },
];

const DEFAULT_SETTINGS: SubtitleSettings = {
  fontFamily: "Inter",
  fontSize: 24,
  fontColor: "#FFFFFF",
  backgroundColor: "#000000",
  backgroundOpacity: 70,
  position: "bottom",
  showCharacterName: true,
  showEmotion: false,
};

// Average reading speed: 150-200 words per minute
// We use 4 seconds minimum per subtitle line
const WORDS_PER_SECOND = 2.5;
const MIN_DURATION = 2;
const MAX_DURATION = 8;

export const SubtitleGenerator = ({
  projectId,
  scenes,
  onSubtitlesGenerated,
}: SubtitleGeneratorProps) => {
  const [settings, setSettings] = useState<SubtitleSettings>(DEFAULT_SETTINGS);
  const [subtitles, setSubtitles] = useState<TimedSubtitle[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    generateSubtitles();
  }, [scenes]);

  const generateSubtitles = () => {
    const generated: TimedSubtitle[] = [];
    let currentTime = 0;

    scenes.forEach((scene) => {
      // Add scene intro (1 second)
      currentTime += 1;

      scene.dialogue.forEach((dialogue, dialogueIndex) => {
        const wordCount = dialogue.line.split(" ").length;
        const duration = Math.min(
          Math.max(wordCount / WORDS_PER_SECOND, MIN_DURATION),
          MAX_DURATION
        );

        generated.push({
          id: `${scene.scene_number}-${dialogueIndex}`,
          sceneNumber: scene.scene_number,
          character: dialogue.character,
          text: dialogue.line,
          emotion: dialogue.emotion,
          startTime: currentTime,
          endTime: currentTime + duration,
        });

        currentTime += duration + 0.5; // 0.5s gap between dialogues
      });

      // Gap between scenes
      currentTime += 1;
    });

    setSubtitles(generated);
    onSubtitlesGenerated?.(generated);
  };

  const updateSetting = <K extends keyof SubtitleSettings>(
    key: K,
    value: SubtitleSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  };

  const generateSRT = () => {
    let srt = "";
    subtitles.forEach((sub, index) => {
      const displayText = settings.showCharacterName
        ? `[${sub.character}${settings.showEmotion ? ` - ${sub.emotion}` : ""}] ${sub.text}`
        : sub.text;

      srt += `${index + 1}\n`;
      srt += `${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n`;
      srt += `${displayText}\n\n`;
    });
    return srt;
  };

  const downloadSubtitles = () => {
    const srt = generateSRT();
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subtitles-${projectId}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Subtitles downloaded as SRT file");
  };

  const getPositionStyle = () => {
    switch (settings.position) {
      case "top":
        return "top-4";
      case "center":
        return "top-1/2 -translate-y-1/2";
      case "bottom":
      default:
        return "bottom-4";
    }
  };

  const totalDuration = subtitles.length > 0 
    ? subtitles[subtitles.length - 1].endTime 
    : 0;

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Subtitles className="h-5 w-5 text-primary" />
            Automatic Subtitles
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {subtitles.length} Captions
            </Badge>
            <Badge variant="outline">
              {Math.ceil(totalDuration)}s Total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            {showSettings ? "Hide Settings" : "Customize"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={downloadSubtitles}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download SRT
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Typography */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Typography
                </h4>
                
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={settings.fontFamily}
                    onValueChange={(value) => updateSetting("fontFamily", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          <span style={{ fontFamily: font.value }}>{font.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Font Size: {settings.fontSize}px</Label>
                  <Slider
                    value={[settings.fontSize]}
                    onValueChange={([value]) => updateSetting("fontSize", value)}
                    min={14}
                    max={48}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={settings.position}
                    onValueChange={(value: "top" | "center" | "bottom") =>
                      updateSetting("position", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>
                          {pos.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Colors
                </h4>

                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => updateSetting("fontColor", color.value)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          settings.fontColor === color.value
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-border"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                    <Input
                      type="color"
                      value={settings.fontColor}
                      onChange={(e) => updateSetting("fontColor", e.target.value)}
                      className="w-8 h-8 p-0 border-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    {BG_PRESETS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() =>
                          updateSetting(
                            "backgroundColor",
                            color.value === "transparent" ? "transparent" : color.value
                          )
                        }
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          settings.backgroundColor === color.value
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-border"
                        }`}
                        style={{
                          backgroundColor:
                            color.value === "transparent" ? "white" : color.value,
                          backgroundImage:
                            color.value === "transparent"
                              ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                              : undefined,
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                        }}
                        title={color.name}
                      />
                    ))}
                    <Input
                      type="color"
                      value={
                        settings.backgroundColor === "transparent"
                          ? "#000000"
                          : settings.backgroundColor
                      }
                      onChange={(e) => updateSetting("backgroundColor", e.target.value)}
                      className="w-8 h-8 p-0 border-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Background Opacity: {settings.backgroundOpacity}%</Label>
                  <Slider
                    value={[settings.backgroundOpacity]}
                    onValueChange={([value]) => updateSetting("backgroundOpacity", value)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Display Options */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.showCharacterName}
                  onCheckedChange={(checked) =>
                    updateSetting("showCharacterName", checked)
                  }
                />
                <Label>Show Character Name</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.showEmotion}
                  onCheckedChange={(checked) => updateSetting("showEmotion", checked)}
                />
                <Label>Show Emotion</Label>
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {showPreview && subtitles.length > 0 && (
          <div className="space-y-4">
            <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg overflow-hidden">
              {/* Preview Frame */}
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Subtitles className="h-16 w-16 mx-auto mb-2 opacity-30" />
                  <p className="text-sm opacity-50">Scene {subtitles[previewIndex]?.sceneNumber}</p>
                </div>
              </div>

              {/* Subtitle */}
              <div
                className={`absolute left-0 right-0 px-4 ${getPositionStyle()}`}
              >
                <div
                  className="mx-auto max-w-2xl text-center px-4 py-2 rounded"
                  style={{
                    fontFamily: settings.fontFamily,
                    fontSize: `${settings.fontSize}px`,
                    color: settings.fontColor,
                    backgroundColor:
                      settings.backgroundColor === "transparent"
                        ? "transparent"
                        : `${settings.backgroundColor}${Math.round(
                            (settings.backgroundOpacity / 100) * 255
                          )
                            .toString(16)
                            .padStart(2, "0")}`,
                    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                  }}
                >
                  {settings.showCharacterName && (
                    <span className="font-semibold">
                      [{subtitles[previewIndex]?.character}
                      {settings.showEmotion && ` - ${subtitles[previewIndex]?.emotion}`}]{" "}
                    </span>
                  )}
                  {subtitles[previewIndex]?.text}
                </div>
              </div>
            </div>

            {/* Preview Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {previewIndex + 1} / {subtitles.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPreviewIndex(Math.min(subtitles.length - 1, previewIndex + 1))
                }
                disabled={previewIndex === subtitles.length - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Subtitle List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <h4 className="text-sm font-medium text-muted-foreground">
            Generated Captions
          </h4>
          {subtitles.map((sub, index) => (
            <div
              key={sub.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                previewIndex === index && showPreview
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => {
                setPreviewIndex(index);
                setShowPreview(true);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Scene {sub.sceneNumber}
                  </Badge>
                  <span className="font-medium text-sm">{sub.character}</span>
                  <Badge variant="secondary" className="text-xs">
                    {sub.emotion}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(sub.startTime)} - {formatTime(sub.endTime)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">{sub.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
