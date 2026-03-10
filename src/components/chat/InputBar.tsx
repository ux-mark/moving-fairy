"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { Camera, Loader2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InputBarProps {
  onSend: (message: string, imageUrls: string[]) => void;
  disabled?: boolean;
  /** External ref for the textarea, allowing parent to manage focus */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function InputBar({ onSend, disabled = false, textareaRef: externalRef }: InputBarProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef ?? internalRef;
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        alert("You can attach up to 20 photos at a time — only the first 20 were added.");
      }
      setImages((prev) => [...prev, ...newImages].slice(0, 20));
      // Reset file input so the same file can be re-selected
      e.target.value = "";
    },
    [images.length]
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

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;

    // Upload images first
    const imageUrls: string[] = [];
    if (images.length > 0) {
      setUploading(true);
      try {
        for (const img of images) {
          const formData = new FormData();
          formData.append("file", img.file);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            imageUrls.push(data.url);
          }
        }
      } finally {
        setUploading(false);
      }
    }

    // Clean up previews
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setText("");

    // Don't send if we had images but all uploads failed
    if (!trimmed && imageUrls.length === 0) return;

    onSend(trimmed, imageUrls);

    // Refocus textarea
    textareaRef.current?.focus();
  }, [text, images, onSend, textareaRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSend = (text.trim().length > 0 || images.length > 0) && !disabled && !uploading;

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="mb-2 flex gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt={`Attached ${i + 1}`}
                className="size-12 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                aria-label={`Remove image ${i + 1}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Camera button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || images.length >= 20}
          aria-label="Take a photo or choose from library"
          className="shrink-0"
        >
          <Camera className="size-5" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="sr-only"
          tabIndex={-1}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Snap a photo or type an item name..."
          aria-label="Message to Aisling"
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2.5 text-base outline-none transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "field-sizing-content max-h-32"
          )}
        />

        {/* Send button */}
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="shrink-0"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
