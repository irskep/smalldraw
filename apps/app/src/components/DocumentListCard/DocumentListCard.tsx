import { Card } from "@/components/ui/card";

type Props = {
  id: string;
  name: string;
  drawingUrl: string;
  thumbnailUrl?: string | null;
};

export function DocumentListCard({
  id,
  name,
  drawingUrl,
  thumbnailUrl,
}: Props) {
  return (
    <a href={drawingUrl}>
      <Card className="flex items-start gap-4 rounded-lg border p-4 text-left transition-all hover:bg-accent">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${name} thumbnail`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No preview</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-medium">{name}</div>
          <div className="pt-1 text-xs text-muted-foreground">{id}</div>
        </div>
      </Card>
    </a>
  );
}
