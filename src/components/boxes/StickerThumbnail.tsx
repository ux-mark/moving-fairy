"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { Skeleton } from "@thefairies/design-system/components";

import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/lib/storage-url";

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
  const [imgError, setImgError] = useState(false);

  const proxiedUrl = imageUrl
    ? imageUrl.startsWith("blob:")
      ? imageUrl
      : proxyImageUrl(imageUrl)
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

  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  // Cached-but-broken images can fire their error before React attaches the
  // listener; the ref callback catches that case at mount.
  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth === 0) handleError();
    },
    [handleError]
  );

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

  // The image is always visible — browsers paint it progressively as it
  // arrives. Gating visibility on a JS load event left the photo permanently
  // hidden whenever that event was missed.
  return (
    <div className={styles.wrap}>
      <div
        role="button"
        tabIndex={0}
        onClick={onExpand}
        onKeyDown={handleKeyDown}
        className={styles.imageButton}
        aria-label={`View sticker photo for ${boxLabel}. Tap to enlarge.`}
      >
        <Image
          ref={imgRef}
          src={proxiedUrl}
          alt={`Box sticker for ${boxLabel}`}
          width={1200}
          height={900}
          className={styles.image}
          onError={handleError}
          unoptimized
        />
      </div>
    </div>
  );
}
