"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import styles from "./StickerLightbox.module.css";

interface StickerLightboxProps {
  imageUrl: string;
  boxLabel: string;
  isOpen: boolean;
  onClose: () => void;
}

function LightboxContent({
  imageUrl,
  boxLabel,
  onClose,
  prefersReducedMotion,
}: {
  imageUrl: string;
  boxLabel: string;
  onClose: () => void;
  prefersReducedMotion: boolean | null;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store previously focused element and focus close button on mount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Lock body scroll
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Escape key closes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      // Trap focus: only close button is focusable
      if (e.key === "Tab") {
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const proxiedUrl = imageUrl.startsWith("blob:")
    ? imageUrl
    : `/api/img?url=${encodeURIComponent(imageUrl)}`;

  return (
    <motion.div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Sticker photo for ${boxLabel}`}
      onClick={handleOverlayClick}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close photo"
      >
        <X style={{ width: 24, height: 24 }} aria-hidden />
      </button>

      <motion.div
        className={styles.imageWrap}
        initial={prefersReducedMotion ? false : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: prefersReducedMotion ? 1 : 0.95, opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={proxiedUrl}
          alt={`Box sticker for ${boxLabel}`}
          className={styles.image}
        />
      </motion.div>
    </motion.div>
  );
}

export function StickerLightbox({
  imageUrl,
  boxLabel,
  isOpen,
  onClose,
}: StickerLightboxProps) {
  const prefersReducedMotion = useReducedMotion();

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <LightboxContent
          imageUrl={imageUrl}
          boxLabel={boxLabel}
          onClose={onClose}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
