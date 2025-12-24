import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface SceneSearchProps {
  onSearch: (query: string) => void;
  resultCount: number;
  totalCount: number;
}

export const SceneSearch = ({ onSearch, resultCount, totalCount }: SceneSearchProps) => {
  const [query, setQuery] = useState("");

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  const isFiltered = query.length > 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search scenes by setting, dialogue, or notes..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {isFiltered && (
        <Badge variant="secondary" className="whitespace-nowrap">
          {resultCount} of {totalCount} scenes
        </Badge>
      )}
    </div>
  );
};
