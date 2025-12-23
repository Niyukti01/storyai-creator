import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Share2, Copy, Check, Link2, Globe, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ShareProjectDialogProps {
  projectId: string;
  projectTitle: string;
  shareToken?: string | null;
  shareEnabled?: boolean;
  onShareUpdate?: (token: string | null, enabled: boolean) => void;
}

export const ShareProjectDialog = ({
  projectId,
  projectTitle,
  shareToken,
  shareEnabled = false,
  onShareUpdate,
}: ShareProjectDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enabled, setEnabled] = useState(shareEnabled);
  const [token, setToken] = useState(shareToken);

  const generateToken = () => {
    return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  };

  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/shared/${token}`;
  };

  const handleToggleShare = async (newEnabled: boolean) => {
    setIsLoading(true);
    try {
      let newToken = token;
      
      // Generate token if enabling and no token exists
      if (newEnabled && !token) {
        newToken = generateToken();
      }

      const { error } = await supabase
        .from("projects")
        .update({
          share_enabled: newEnabled,
          share_token: newEnabled ? newToken : token,
        })
        .eq("id", projectId);

      if (error) throw error;

      setEnabled(newEnabled);
      setToken(newToken);
      onShareUpdate?.(newToken, newEnabled);

      toast.success(newEnabled ? "Sharing enabled" : "Sharing disabled");
    } catch (error: any) {
      console.error("Error toggling share:", error);
      toast.error("Failed to update sharing settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateLink = async () => {
    setIsLoading(true);
    try {
      const newToken = generateToken();

      const { error } = await supabase
        .from("projects")
        .update({ share_token: newToken })
        .eq("id", projectId);

      if (error) throw error;

      setToken(newToken);
      onShareUpdate?.(newToken, enabled);
      toast.success("New share link generated");
    } catch (error: any) {
      console.error("Error regenerating link:", error);
      toast.error("Failed to regenerate link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share Storyboard
          </DialogTitle>
          <DialogDescription>
            Share "{projectTitle}" with collaborators using a public link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {enabled ? (
                <Globe className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="share-toggle" className="font-medium">
                  Public sharing
                </Label>
                <p className="text-sm text-muted-foreground">
                  {enabled
                    ? "Anyone with the link can view"
                    : "Only you can access"}
                </p>
              </div>
            </div>
            <Switch
              id="share-toggle"
              checked={enabled}
              onCheckedChange={handleToggleShare}
              disabled={isLoading}
            />
          </div>

          {/* Share Link */}
          {enabled && token && (
            <div className="space-y-3">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={getShareUrl()}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  disabled={isLoading}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateLink}
                disabled={isLoading}
                className="text-muted-foreground"
              >
                Generate new link
              </Button>
              <p className="text-xs text-muted-foreground">
                Generating a new link will invalidate the previous one.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
