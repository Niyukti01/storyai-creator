import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Share2, Copy, Check, Link2, Globe, Lock, RefreshCw, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ShareProjectDialogProps {
  projectId: string;
  projectTitle: string;
  shareToken?: string | null;
  shareEnabled?: boolean;
  onShareUpdate?: (token: string | null, enabled: boolean) => void;
}

type ConfirmAction = "rotate" | "revoke" | null;

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
  const [token, setToken] = useState<string | null | undefined>(shareToken);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const generateToken = () => {
    return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  };

  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/shared/${token}`;
  };

  const handleToggleShare = async (newEnabled: boolean) => {
    // Turning sharing off should also revoke the token so the old URL cannot be re-enabled.
    if (!newEnabled) {
      setConfirmAction("revoke");
      return;
    }

    setIsLoading(true);
    try {
      const newToken = token ?? generateToken();

      const { error } = await supabase
        .from("projects")
        .update({ share_enabled: true, share_token: newToken })
        .eq("id", projectId);

      if (error) throw error;

      setEnabled(true);
      setToken(newToken);
      onShareUpdate?.(newToken, true);
      toast.success("Sharing enabled");
    } catch (error: any) {
      console.error("Error toggling share:", error);
      toast.error("Failed to update sharing settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotate = async () => {
    setIsLoading(true);
    try {
      const newToken = generateToken();
      const { error } = await supabase
        .from("projects")
        .update({ share_token: newToken, share_enabled: true })
        .eq("id", projectId);

      if (error) throw error;

      setToken(newToken);
      setEnabled(true);
      onShareUpdate?.(newToken, true);

      // Notify previously invited recipients of the new link.
      const newShareUrl = `${window.location.origin}/shared/${newToken}`;
      const { data: notifyRes } = await supabase.functions.invoke(
        "notify-share-change",
        { body: { projectId, changeType: "rotated", newShareUrl } },
      );
      const sent = (notifyRes as { sent?: number } | null)?.sent ?? 0;
      toast.success(
        sent > 0
          ? `Share link rotated — ${sent} recipient${sent === 1 ? "" : "s"} notified`
          : "Share link rotated — previous link no longer works",
      );
    } catch (error: any) {
      console.error("Error rotating link:", error);
      toast.error("Failed to rotate share link");
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };

  const handleRevoke = async () => {
    setIsLoading(true);
    try {
      // Notify BEFORE deleting recipients (revoke path clears them server-side).
      const { data: notifyRes } = await supabase.functions.invoke(
        "notify-share-change",
        { body: { projectId, changeType: "revoked" } },
      );

      const { error } = await supabase
        .from("projects")
        .update({ share_enabled: false, share_token: null })
        .eq("id", projectId);

      if (error) throw error;

      setEnabled(false);
      setToken(null);
      onShareUpdate?.(null, false);
      const sent = (notifyRes as { sent?: number } | null)?.sent ?? 0;
      toast.success(
        sent > 0
          ? `Access revoked — ${sent} recipient${sent === 1 ? "" : "s"} notified`
          : "Access revoked — all previous share links are now invalid",
      );
    } catch (error: any) {
      console.error("Error revoking access:", error);
      toast.error("Failed to revoke access");
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
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
    <>
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
                    {enabled ? "Anyone with the link can view" : "Only you can access"}
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

            {enabled && token && (
              <div className="space-y-3">
                <Label>Share link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={getShareUrl()} className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopy} disabled={isLoading}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction("rotate")}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Rotate link
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmAction("revoke")}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <ShieldOff className="h-4 w-4" />
                    Revoke access
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rotating issues a new link and immediately invalidates the previous one.
                  Revoking disables sharing and deletes the token so no old link will work.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "rotate" ? "Rotate share link?" : "Revoke share access?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "rotate"
                ? "A new link will be generated. Anyone using the previous link will lose access immediately."
                : "Sharing will be turned off and the current token will be deleted. All existing links to this project will stop working."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction === "rotate") handleRotate();
                else if (confirmAction === "revoke") handleRevoke();
              }}
            >
              {confirmAction === "rotate" ? "Rotate link" : "Revoke access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
