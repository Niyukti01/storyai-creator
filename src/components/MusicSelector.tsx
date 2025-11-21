import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Play, Pause, Check } from "lucide-react";
import { musicLibrary, musicCategories, musicMoods, type MusicTrack } from "@/lib/musicLibrary";
import { cn } from "@/lib/utils";

interface MusicSelectorProps {
  selectedTrack: MusicTrack | null;
  onSelectTrack: (track: MusicTrack) => void;
}

export const MusicSelector = ({ selectedTrack, onSelectTrack }: MusicSelectorProps) => {
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMood, setFilterMood] = useState<string>("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = (track: MusicTrack) => {
    if (playingTrack === track.id) {
      audioRef.current?.pause();
      setPlayingTrack(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(track.previewUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingTrack(null);
      setPlayingTrack(track.id);
    }
  };

  const handleSelectTrack = (track: MusicTrack) => {
    onSelectTrack(track);
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingTrack(null);
    }
  };

  const filteredTracks = musicLibrary.filter((track) => {
    const categoryMatch = filterCategory === "all" || track.category === filterCategory;
    const moodMatch = filterMood === "all" || track.mood === filterMood;
    return categoryMatch && moodMatch;
  });

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Background Music
        </CardTitle>
        <CardDescription>
          Choose a royalty-free track to accompany your animation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="category" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="mood">By Mood</TabsTrigger>
          </TabsList>

          <TabsContent value="category" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={filterCategory === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterCategory("all")}
              >
                All
              </Badge>
              {musicCategories.map((category) => (
                <Badge
                  key={category}
                  variant={filterCategory === category ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mood" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={filterMood === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterMood("all")}
              >
                All
              </Badge>
              {musicMoods.map((mood) => (
                <Badge
                  key={mood}
                  variant={filterMood === mood ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterMood(mood)}
                >
                  {mood}
                </Badge>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <ScrollArea className="h-[400px] mt-4">
          <div className="space-y-2 pr-4">
            {filteredTracks.map((track) => (
              <div
                key={track.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:border-primary/50",
                  selectedTrack?.id === track.id && "border-primary bg-primary/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm truncate">{track.name}</h4>
                    {selectedTrack?.id === track.id && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {track.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {track.mood}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{track.duration}</span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handlePlayPause(track)}
                  >
                    {playingTrack === track.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedTrack?.id === track.id ? "secondary" : "default"}
                    onClick={() => handleSelectTrack(track)}
                  >
                    {selectedTrack?.id === track.id ? "Selected" : "Select"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {selectedTrack && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
            <p className="text-sm font-medium mb-1">Selected Track:</p>
            <p className="text-sm">
              <span className="font-semibold">{selectedTrack.name}</span> by {selectedTrack.artist}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
