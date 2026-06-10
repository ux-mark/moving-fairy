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
  const [imgLoaded, setImgLoaded] = useState(false);
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

  const handleLoad = useCallback(() => {
    setImgLoaded(true);
    setImgError(false);
  }, []);

  const handleError = useCallback(() => {
    setImgError(true);
    setImgLoaded(true);
  }, []);

  // Cached images can finish loading before React's load listener attaches,
  // leaving the thumbnail stuck behind the skeleton forever. The ref callback
  // runs at mount: if the browser already has the image, reveal it now.
  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (!el || !el.complete) return;
      if (el.naturalWidth > 0) handleLoad();
      else handleError();
    },
    [handleLoad, handleError]
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
        <Image
          ref={imgRef}
          src={proxiedUrl}
          alt={`Box sticker for ${boxLabel}`}
          width={1200}
          height={900}
          className={styles.image}
          onLoad={handleLoad}
          onError={handleError}
          unoptimized
        />
      </div>
    </div>
  );
}
