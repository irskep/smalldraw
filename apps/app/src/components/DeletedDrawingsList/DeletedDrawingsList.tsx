import { RotateCcw as RotateCcwIcon } from "lucide";
import { RotateCcw } from "lucide-react";
import { DsThumbnailTile } from "@/components/DsThumbnailTile/DsThumbnailTile";

export type DeletedDrawingListItem = {
  id: string;
  name: string;
  deletedAt: Date | string;
  thumbnailUrl: string | null;
};

type Props = {
  documents: DeletedDrawingListItem[];
  emptyLayout?: "card" | "plain";
  emptyLabel: string;
  isLoading: boolean;
  layout?: "grid" | "list";
  onRestore: (document: DeletedDrawingListItem) => void;
  restoringId: string | null;
};

export const DeletedDrawingsList: React.FC<Props> = ({
  documents,
  emptyLayout = "plain",
  emptyLabel,
  isLoading,
  layout = "grid",
  onRestore,
  restoringId,
}) => {
  if (isLoading) {
    return <p className="portal-muted">Loading deleted drawings...</p>;
  }

  if (documents.length === 0) {
    if (emptyLayout === "card") {
      return (
        <div className="portal-card portal-card--centered">
          <p className="portal-muted">{emptyLabel}</p>
        </div>
      );
    }
    return <p className="portal-muted">{emptyLabel}</p>;
  }

  if (layout === "list") {
    return (
      <div className="portal-list">
        {documents.map((document) => (
          <div key={document.id} className="portal-list-item">
            <div className="portal-list-item__main">
              <div>{document.name}</div>
              <div className="portal-muted portal-muted--small portal-code">
                {document.id}
              </div>
              <div className="portal-muted portal-muted--small">
                Deleted {formatDeletedAt(document.deletedAt)}
              </div>
            </div>
            <button
              type="button"
              className="ds-button"
              disabled={restoringId === document.id}
              onClick={() => onRestore(document)}
            >
              <RotateCcw className="portal-action-icon" />
              Restore
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="portal-launcher-grid">
      {documents.map((document) => (
        <div key={document.id} className="portal-launcher-card">
          <DsThumbnailTile
            action={{
              label: `Restore ${document.name}`,
              icon: RotateCcwIcon,
              onPress: () => onRestore(document),
              disabled: restoringId === document.id,
            }}
            badge={{ label: "Deleted", tone: "default" }}
            emptyLabel="No preview"
            imageAlt={`${document.name} thumbnail`}
            imageSrc={document.thumbnailUrl ?? undefined}
            openDisabled
            openLabel={`${document.name} is deleted`}
          />
          <p className="portal-launcher-card__meta">
            Deleted {formatDeletedAt(document.deletedAt)}
          </p>
        </div>
      ))}
    </div>
  );
};

function formatDeletedAt(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "at an unknown time";
  }
  return date.toLocaleString();
}
