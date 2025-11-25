import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecorderSimpleProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isUploading?: boolean;
}

export const VoiceRecorderSimple = ({ onRecordingComplete, isUploading = false }: VoiceRecorderSimpleProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: "Speak your sentence clearly",
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({
        title: "Recording complete",
        description: "You can now preview or save your recording",
      });
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    audioChunksRef.current = [];
  };

  const handleSave = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {!isRecording && !audioUrl && (
          <Button
            onClick={startRecording}
            variant="default"
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            Start Recording
          </Button>
        )}
        
        {isRecording && (
          <Button
            onClick={stopRecording}
            variant="destructive"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop Recording
          </Button>
        )}
      </div>

      {audioUrl && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <audio src={audioUrl} controls className="w-full" />
          
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isUploading}
              variant="default"
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Save Recording"}
            </Button>
            
            <Button
              onClick={deleteRecording}
              disabled={isUploading}
              variant="outline"
              size="icon"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Recording in progress...
        </div>
      )}
    </div>
  );
};
