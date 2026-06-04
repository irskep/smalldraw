import {
  createThumbnailTile,
  type ThumbnailTile,
} from "@smalldraw/design-system";
import type { IconNode } from "lucide";
import { useEffect, useRef } from "react";
import { mount, unmount } from "redom";

export interface DsThumbnailTileProps {
  badge: { label: string; tone?: "default" | "positive" } | null;
  deleteAction?: {
    label: string;
    icon: IconNode;
    onPress: () => void;
    disabled?: boolean;
  };
  emptyLabel: string;
  imageAlt: string;
  imageSrc?: string;
  onOpen: () => void;
  openLabel: string;
}

export function DsThumbnailTile({
  badge,
  deleteAction,
  emptyLabel,
  imageAlt,
  imageSrc,
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
    tile.setOnOpen(onOpen);
    tile.setBadge(badge);
    tile.setAction(
      deleteAction
        ? {
            label: deleteAction.label,
            icon: deleteAction.icon,
            onPress: deleteAction.onPress,
            disabled: deleteAction.disabled,
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
  }, [badge, deleteAction, emptyLabel, imageAlt, imageSrc, onOpen, openLabel]);

  return <div ref={hostRef} />;
}
