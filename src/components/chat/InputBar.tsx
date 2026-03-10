"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { Camera, X } from "lucide-react";

import { ChatInput, Button, useToast } from "@thefairies/design-system/components";
import styles from "./InputBar.module.css";

interface InputBarProps {
  onSend: (message: string, imageUrls: string[]) => void;
  disabled?: boolean;
  /** External ref for the textarea — DS ChatInput manages its own ref internally;
   *  this prop is accepted for API compatibility but is unused in the DS version. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function InputBar({ onSend, disabled = false }: InputBarProps) {
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newImages: { file: File; preview: string }[] = [];
      for (let i = 0; i < files.length && images.length + newImages.length < 20; i++) {
        const file = files[i];
        if (!file) continue;
        newImages.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }

      if (images.length + files.length > 20) {
        addToast("warning", "You can attach up to 20 photos at a time — only the first 20 were added.");
      }
      setImages((prev) => [...prev, ...newImages].slice(0, 20));
      // Reset file input so the same file can be re-selected
      e.target.value = "";
    },
    [images.length, addToast]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item) URL.revokeObjectURL(item.preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // DS ChatInput calls onSend(text) — we intercept, upload images, then forward
  const handleDSSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed && images.length === 0) return;

      // Upload images first
      const imageUrls: string[] = [];
      let uploadFailed = false;
      if (images.length > 0) {
        setUploading(true);
        try {
          for (const img of images) {
            const formData = new FormData();
            formData.append("file", img.file);

            try {
              const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });

              if (res.ok) {
                const data = await res.json();
                if (data.url) {
                  imageUrls.push(data.url);
                } else {
                  uploadFailed = true;
                }
              } else {
                uploadFailed = true;
                let errMsg = "Upload failed";
                try {
                  const errData = await res.json();
                  if (errData.error) errMsg = errData.error;
                } catch {
                  // ignore parse error
                }
                console.error(`[InputBar] Image upload failed: ${errMsg}`);
              }
            } catch (err) {
              uploadFailed = true;
              console.error("[InputBar] Image upload error:", err);
            }
          }
        } finally {
          setUploading(false);
        }
      }

      // If some uploads failed, warn the user
      if (uploadFailed && imageUrls.length < images.length) {
        const failedCount = images.length - imageUrls.length;
        if (imageUrls.length === 0) {
          addToast(
            "error",
            `${failedCount === 1 ? "The image" : `All ${failedCount} images`} couldn't be uploaded. Please try again.`
          );
        } else {
          addToast(
            "warning",
            `${failedCount} of ${images.length} ${images.length === 1 ? "image" : "images"} couldn't be uploaded. The rest will be sent.`
          );
        }
      }

      // Don't send if we had images but all uploads failed and no text
      if (!trimmed && imageUrls.length === 0) {
        if (uploadFailed) return;
        images.forEach((img) => URL.revokeObjectURL(img.preview));
        setImages([]);
        return;
      }

      // Clean up previews
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setImages([]);

      // Filter out any falsy URLs as a safety net
      const validUrls = imageUrls.filter(Boolean);
      onSend(trimmed, validUrls);
    },
    [images, onSend, addToast]
  );

  // Image preview strip — passed as aboveInput slot
  const imagePreviewStrip =
    images.length > 0 ? (
      <div className={styles.previewStrip}>
        {images.map((img, i) => (
          <div key={i} className={styles.previewItem}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.preview}
              alt={`Attached ${i + 1}`}
              className={styles.previewThumb}
            />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className={styles.previewRemove}
              aria-label={`Remove image ${i + 1}`}
            >
              <X className={styles.previewRemoveIcon} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    ) : undefined;

  // Camera button — passed as startAdornment slot
  const cameraButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => fileInputRef.current?.click()}
      disabled={disabled || uploading || images.length >= 20}
      aria-label="Take a photo or choose from library"
    >
      <Camera aria-hidden="true" />
    </Button>
  );

  return (
    <div className={styles.root}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className={styles.hiddenFileInput}
        tabIndex={-1}
      />
      <ChatInput
        onSend={handleDSSend}
        disabled={disabled || uploading}
        placeholder="Snap a photo or type an item name..."
        startAdornment={cameraButton}
        aboveInput={imagePreviewStrip}
      />
    </div>
  );
}
