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
    <a
      href={drawingUrl}
      className="account-card account-document-card"
      aria-label={`Open ${name}`}
    >
      <div className="account-document-card__thumbnail">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={`${name} thumbnail`} />
        ) : (
          <span className="account-muted account-muted--small">No preview</span>
        )}
      </div>
      <div className="account-document-card__body">
        <div className="account-document-card__title">{name}</div>
        <div className="account-muted account-muted--small account-code">
          {id}
        </div>
      </div>
    </a>
  );
}
