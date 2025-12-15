import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: Dialogue[];
  action: string;
}

interface CharacterIllustration {
  name: string;
  description: string;
  imageUrl?: string;
}

interface StoryboardPDFExportProps {
  projectTitle: string;
  genre: string;
  storySummary: string;
  theme: string;
  estimatedDuration: string;
  scenes: Scene[];
  characters: CharacterIllustration[];
}

export const StoryboardPDFExport = ({
  projectTitle,
  genre,
  storySummary,
  theme,
  estimatedDuration,
  scenes,
  characters,
}: StoryboardPDFExportProps) => {
  const [exporting, setExporting] = useState(false);
  const [includeCharacters, setIncludeCharacters] = useState(true);
  const [includeDialogue, setIncludeDialogue] = useState(true);
  const [includeActions, setIncludeActions] = useState(true);

  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    toast.loading("Generating PDF...", { id: "pdf-export" });

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      const addNewPageIfNeeded = (heightNeeded: number) => {
        if (yPosition + heightNeeded > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Title Page
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      const titleLines = pdf.splitTextToSize(projectTitle, contentWidth);
      pdf.text(titleLines, pageWidth / 2, 60, { align: "center" });

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Genre: ${genre}`, pageWidth / 2, 80, { align: "center" });
      pdf.text(`Duration: ${estimatedDuration}`, pageWidth / 2, 88, { align: "center" });
      pdf.text(`Theme: ${theme}`, pageWidth / 2, 96, { align: "center" });

      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);
      const summaryLines = pdf.splitTextToSize(storySummary, contentWidth - 20);
      pdf.text(summaryLines, pageWidth / 2, 120, { align: "center" });

      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text("STORYBOARD DOCUMENT", pageWidth / 2, 180, { align: "center" });
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 188, { align: "center" });
      pdf.text(`Scenes: ${scenes.length}`, pageWidth / 2, 196, { align: "center" });

      // Characters Page
      if (includeCharacters && characters.length > 0) {
        pdf.addPage();
        yPosition = margin;

        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("Characters", margin, yPosition);
        yPosition += 15;

        for (const character of characters) {
          addNewPageIfNeeded(60);

          // Character image if available
          if (character.imageUrl) {
            const imageData = await loadImageAsBase64(character.imageUrl);
            if (imageData) {
              try {
                pdf.addImage(imageData, "JPEG", margin, yPosition, 40, 40);
              } catch {
                // Image failed to load, skip it
              }
            }
          }

          const textX = character.imageUrl ? margin + 50 : margin;
          const textWidth = character.imageUrl ? contentWidth - 50 : contentWidth;

          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(character.name, textX, yPosition + 8);

          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(80, 80, 80);
          const descLines = pdf.splitTextToSize(character.description, textWidth);
          pdf.text(descLines, textX, yPosition + 16);

          yPosition += Math.max(50, descLines.length * 5 + 25);
        }
      }

      // Scenes Pages
      for (const scene of scenes) {
        pdf.addPage();
        yPosition = margin;

        // Scene header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPosition - 5, contentWidth, 12, "F");

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Scene ${scene.scene_number}`, margin + 3, yPosition + 3);
        yPosition += 15;

        // Setting
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(100, 100, 100);
        pdf.text("SETTING", margin, yPosition);
        yPosition += 5;

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        const settingLines = pdf.splitTextToSize(scene.setting, contentWidth);
        pdf.text(settingLines, margin, yPosition);
        yPosition += settingLines.length * 5 + 8;

        // Description
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(100, 100, 100);
        pdf.text("DESCRIPTION", margin, yPosition);
        yPosition += 5;

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        const descLines = pdf.splitTextToSize(scene.description, contentWidth);
        pdf.text(descLines, margin, yPosition);
        yPosition += descLines.length * 5 + 8;

        // Camera Angle
        if (scene.camera_angle) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(100, 100, 100);
          pdf.text("CAMERA ANGLE", margin, yPosition);
          yPosition += 5;

          pdf.setFontSize(11);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
          pdf.text(scene.camera_angle, margin, yPosition);
          yPosition += 10;
        }

        // Actions
        if (includeActions && scene.action) {
          addNewPageIfNeeded(30);

          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(100, 100, 100);
          pdf.text("ACTION", margin, yPosition);
          yPosition += 5;

          pdf.setFontSize(11);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(60, 60, 60);
          const actionLines = pdf.splitTextToSize(scene.action, contentWidth);
          pdf.text(actionLines, margin, yPosition);
          yPosition += actionLines.length * 5 + 10;
        }

        // Dialogue
        if (includeDialogue && scene.dialogue && scene.dialogue.length > 0) {
          addNewPageIfNeeded(20);

          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(100, 100, 100);
          pdf.text("DIALOGUE", margin, yPosition);
          yPosition += 8;

          for (const dialogue of scene.dialogue) {
            addNewPageIfNeeded(25);

            // Character name with emotion
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(50, 50, 50);
            pdf.text(`${dialogue.character.toUpperCase()} (${dialogue.emotion})`, margin + 20, yPosition);
            yPosition += 5;

            // Dialogue line
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(0, 0, 0);
            const dialogueLines = pdf.splitTextToSize(`"${dialogue.line}"`, contentWidth - 25);
            pdf.text(dialogueLines, margin + 20, yPosition);
            yPosition += dialogueLines.length * 4 + 8;
          }
        }
      }

      // Save PDF
      const fileName = `${projectTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_storyboard.pdf`;
      pdf.save(fileName);

      toast.success("PDF exported successfully!", { id: "pdf-export" });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF", { id: "pdf-export" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-primary" />
          Export Storyboard PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Download a PDF document of your storyboard with scene descriptions, dialogue, and character illustrations for sharing and review.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="include-characters" className="cursor-pointer">
              Include character illustrations
            </Label>
            <Switch
              id="include-characters"
              checked={includeCharacters}
              onCheckedChange={setIncludeCharacters}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-dialogue" className="cursor-pointer">
              Include scene dialogue
            </Label>
            <Switch
              id="include-dialogue"
              checked={includeDialogue}
              onCheckedChange={setIncludeDialogue}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-actions" className="cursor-pointer">
              Include scene actions
            </Label>
            <Switch
              id="include-actions"
              checked={includeActions}
              onCheckedChange={setIncludeActions}
            />
          </div>
        </div>

        <Button
          onClick={exportPDF}
          disabled={exporting}
          className="w-full gap-2"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
