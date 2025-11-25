import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mic, Square, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  projectId: string;
  existingVoiceSampleUrl?: string | null;
  onVoiceSampleUpdate: (url: string) => void;
}

export const VoiceRecorder = ({ projectId, existingVoiceSampleUrl, onVoiceSampleUpdate }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingVoiceSampleUrl || null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        await uploadVoiceSample(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started. Speak for 10-30 seconds.");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadVoiceSample = async (blob: Blob) => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to upload");
        return;
      }

      const fileName = `${projectId}-${Date.now()}.webm`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("voice-samples")
        .upload(filePath, blob, {
          contentType: "audio/webm",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("voice-samples")
        .getPublicUrl(filePath);

      await supabase
        .from("projects")
        .update({ voice_sample_url: publicUrl })
        .eq("id", projectId);

      onVoiceSampleUpdate(publicUrl);
      toast.success("Voice sample uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading voice sample:", error);
      toast.error("Failed to upload voice sample");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    await uploadVoiceSample(file);
  };

  const deleteVoiceSample = async () => {
    try {
      await supabase
        .from("projects")
        .update({ voice_sample_url: null })
        .eq("id", projectId);

      setAudioUrl(null);
      onVoiceSampleUpdate("");
      toast.success("Voice sample removed");
    } catch (error) {
      console.error("Error deleting voice sample:", error);
      toast.error("Failed to delete voice sample");
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          Voice Cloning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload or record a 10-30 second voice sample to generate character dialogue in this voice style.
        </p>

        {audioUrl && (
          <div className="space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteVoiceSample}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isRecording ? (
            <>
              <Button
                onClick={startRecording}
                disabled={uploading}
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                Record Voice Sample
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Audio File
              </Button>
            </>
          ) : (
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

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {uploading && (
          <p className="text-sm text-muted-foreground">Uploading voice sample...</p>
        )}
      </CardContent>
    </Card>
  );
};
