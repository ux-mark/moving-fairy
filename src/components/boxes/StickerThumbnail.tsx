"use client";

import { useState, useCallback } from "react";
import { ImageOff } from "lucide-react";
import { Skeleton } from "@thefairies/design-system/components";

import { cn } from "@/lib/utils";

import styles from "./StickerThumbnail.module.css";

interface StickerThumbnailProps {
  imageUrl: string | null;
  boxLabel: string;
  onExpand: () => void;
  isLoading?: boolean;
}

export function StickerThumbnail({
  imageUrl,
  boxLabel,
  onExpand,
  isLoading = false,
}: StickerThumbnailProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const proxiedUrl = imageUrl
    ? imageUrl.startsWith("blob:")
      ? imageUrl
      : `/api/img?url=${encodeURIComponent(imageUrl)}`
    : null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onExpand();
      }
    },
    [onExpand]
  );

  const handleLoad = useCallback(() => {
    setImgLoaded(true);
    setImgError(false);
  }, []);

  const handleError = useCallback(() => {
    setImgError(true);
    setImgLoaded(true);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <Skeleton className={cn(styles.skeleton)} />
      </div>
    );
  }

  if (!proxiedUrl) {
    return null;
  }

  if (imgError) {
    return (
      <div className={styles.wrap}>
        <div className={styles.errorPlaceholder} role="img" aria-label="Photo could not be loaded">
          <ImageOff style={{ width: 24, height: 24 }} aria-hidden />
          <span className={styles.errorText}>Photo could not be loaded</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {!imgLoaded && (
        <Skeleton className={cn(styles.skeleton)} />
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onExpand}
        onKeyDown={handleKeyDown}
        className={styles.imageButton}
        aria-label={`View sticker photo for ${boxLabel}. Tap to enlarge.`}
        style={{ display: imgLoaded ? "block" : "none" }}
      >
        <img
          src={proxiedUrl}
          alt={`Box sticker for ${boxLabel}`}
          className={styles.image}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}
