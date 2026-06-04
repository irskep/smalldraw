import {
  createThumbnailTile,
  type ThumbnailTile,
} from "@smalldraw/design-system";
import type { IconNode } from "lucide";
import { useEffect, useRef } from "react";
import { mount, unmount } from "redom";

export interface DsThumbnailTileProps {
  badge: { label: string; tone?: "default" | "positive" } | null;
  action?: {
    label: string;
    icon: IconNode;
    onPress: () => void;
    disabled?: boolean;
  };
  emptyLabel: string;
  imageAlt: string;
  imageSrc?: string;
  onOpen?: () => void;
  openDisabled?: boolean;
  openLabel: string;
}

export function DsThumbnailTile({
  action,
  badge,
  emptyLabel,
  imageAlt,
  imageSrc,
  openDisabled = false,
  onOpen,
  openLabel,
}: DsThumbnailTileProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<ThumbnailTile | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const host = hostRef.current;
    const tile = createThumbnailTile();
    mount(host, tile);
    tileRef.current = tile;

    return () => {
      unmount(host, tile);
      tileRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tile = tileRef.current;
    if (!tile) {
      return;
    }

    tile.setCurrent(false);
    tile.setOpenLabel(openLabel);
    tile.setOpenTitle(openLabel);
    tile.setOpenDisabled(openDisabled || !onOpen);
    tile.setOnOpen(onOpen ?? null);
    tile.setBadge(badge);
    tile.setAction(
      action
        ? {
            label: action.label,
            icon: action.icon,
            onPress: action.onPress,
            disabled: action.disabled,
          }
        : null,
    );

    if (imageSrc) {
      const image = document.createElement("img");
      image.src = imageSrc;
      image.alt = imageAlt;
      tile.setMedia(image);
      return;
    }

    const empty = document.createElement("span");
    empty.className = "account-launcher-card__empty";
    empty.textContent = emptyLabel;
    tile.setMedia(empty);
  }, [
    action,
    badge,
    emptyLabel,
    imageAlt,
    imageSrc,
    onOpen,
    openDisabled,
    openLabel,
  ]);

  return <div ref={hostRef} />;
}
