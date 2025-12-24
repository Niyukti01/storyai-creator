import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";

interface VideoThumbnailProps {
  src: string;
  className?: string;
}

export const VideoThumbnail = ({ src, className = "" }: VideoThumbnailProps) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = src;
    video.muted = true;
    video.preload = "metadata";

    video.onloadeddata = () => {
      video.currentTime = 1; // Seek to 1 second for a better frame
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL("image/jpeg", 0.8));
      }
      setIsLoading(false);
    };

    video.onerror = () => {
      console.error("Failed to load video for thumbnail");
      setIsLoading(false);
    };

    return () => {
      video.src = "";
    };
  }, [src]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  if (isPlaying) {
    return (
      <video
        ref={videoRef}
        controls
        autoPlay
        className={className}
        poster={thumbnail || undefined}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <div
      className={`relative cursor-pointer group ${className}`}
      onClick={handlePlay}
    >
      {isLoading ? (
        <div className="w-full aspect-video bg-muted animate-pulse rounded-lg flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Loading preview...</span>
        </div>
      ) : thumbnail ? (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full rounded-lg object-cover"
        />
      ) : (
        <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Video preview</span>
        </div>
      )}
      
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg">
          <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
        </div>
      </div>
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
