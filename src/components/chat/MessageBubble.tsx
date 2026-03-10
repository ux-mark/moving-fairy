"use client";

import { useState } from "react";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { Verdict } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardData {
  item: string;
  verdict: string;
  confidence: number;
  rationale: string;
  action: string;
  import_note?: string;
  // save fields
  item_description?: string;
  image_url?: string;
  voltage_compatible?: boolean;
  needs_transformer?: boolean;
  estimated_ship_cost_usd?: number;
  estimated_replace_cost_usd?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  type?: "text" | "card";
  card?: CardData;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onSendMessage?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Inline formatting (bold, italic, verdict badges in prose)
// ---------------------------------------------------------------------------

const VERDICT_PATTERN =
  /\b(SHIP|CARRY|SELL|DONATE|DISCARD|DECIDE[_ ]LATER)\b/g;

function renderInlineFormatting(text: string) {
  const parts: (string | { type: "verdict"; value: Verdict })[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(VERDICT_PATTERN)) {
    if (match.index !== undefined && match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0].replace(" ", "_") as Verdict;
    if (raw in Verdict) {
      parts.push({ type: "verdict", value: raw });
    } else {
      parts.push(match[0]);
    }
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.map((part, i) => {
    if (typeof part === "string") {
      // Render **bold** patterns
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith("**") && bp.endsWith("**")) {
          return (
            <strong key={`${i}-${j}`} className="font-semibold">
              {bp.slice(2, -2)}
            </strong>
          );
        }
        // Render *italic* patterns
        const italicParts = bp.split(/(\*[^*]+\*)/g);
        return italicParts.map((ip, k) => {
          if (ip.startsWith("*") && ip.endsWith("*")) {
            return (
              <em
                key={`${i}-${j}-${k}`}
                className="italic text-muted-foreground"
              >
                {ip.slice(1, -1)}
              </em>
            );
          }
          return <span key={`${i}-${j}-${k}`}>{ip}</span>;
        });
      });
    }
    return <VerdictBadge key={i} verdict={part.value} className="mx-0.5" />;
  });
}

// ---------------------------------------------------------------------------
// Verdict-to-border-colour mapping for assessment cards
// ---------------------------------------------------------------------------

const VERDICT_BORDER_COLOUR: Record<string, string> = {
  SHIP: "border-l-verdict-ship",
  CARRY: "border-l-verdict-carry",
  SELL: "border-l-verdict-sell",
  DONATE: "border-l-verdict-donate",
  DISCARD: "border-l-verdict-discard",
  DECIDE_LATER: "border-l-verdict-decide-later",
};

// ---------------------------------------------------------------------------
// Confidence indicator
// ---------------------------------------------------------------------------

function confidenceIndicator(confidence: number): string {
  if (confidence >= 85) return "\u{1F7E2}"; // green circle
  if (confidence >= 60) return "\u{1F7E1}"; // yellow circle
  return "\u{1F534}"; // red circle
}

// ---------------------------------------------------------------------------
// Assessment Card (standalone, full-width)
// ---------------------------------------------------------------------------

function AssessmentCard({
  card,
  onSendMessage,
}: {
  card: CardData;
  onSendMessage?: (text: string) => void;
}) {
  const verdictNormalised = card.verdict.replace(/\s+/g, "_").toUpperCase();
  const borderClass =
    VERDICT_BORDER_COLOUR[verdictNormalised] ?? "border-l-border";
  const isValidVerdict = verdictNormalised in Verdict;
  const [confirmState, setConfirmState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function handleConfirm() {
    setConfirmState("saving");
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: card.item,
          verdict: verdictNormalised,
          advice_text: card.rationale,
          item_description: card.item_description,
          image_url: card.image_url,
          voltage_compatible: card.voltage_compatible,
          needs_transformer: card.needs_transformer,
          estimated_ship_cost: card.estimated_ship_cost_usd,
          estimated_replace_cost: card.estimated_replace_cost_usd,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setConfirmState("saved");
    } catch {
      setConfirmState("error");
    }
  }

  function handleEdit() {
    onSendMessage?.(`Please revise your assessment for ${card.item}`);
  }

  return (
    <div
      className={`mx-4 my-2 rounded-2xl border border-border bg-card shadow-sm border-l-4 ${borderClass}`}
      role="region"
      aria-label={`Assessment for ${card.item}`}
    >
      <div className="p-4 sm:p-5">
        {/* Top row: item name + verdict badge */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground leading-snug">
            {card.item}
          </h3>
          {isValidVerdict && (
            <VerdictBadge
              verdict={verdictNormalised as Verdict}
              className="px-3 py-1.5 text-sm"
            />
          )}
        </div>

        {/* Confidence */}
        <p className="mt-1.5 text-sm text-muted-foreground">
          {confidenceIndicator(card.confidence)} {card.confidence}% confidence
        </p>

        {/* Rationale */}
        {card.rationale && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            {card.rationale}
          </p>
        )}

        {/* Import note (amber warning, only when present) */}
        {card.import_note && (
          <p className="mt-2 rounded px-2 py-1 text-xs leading-relaxed text-amber-700 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/30">
            {"\u26A0\uFE0F"} {card.import_note}
          </p>
        )}

        {/* Action */}
        {card.action && (
          <p className="mt-3 pt-3 border-t border-border text-sm font-medium text-foreground">
            {"\u2192"} {card.action}
          </p>
        )}

        {/* Confirm / Edit actions */}
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          {confirmState === "saved" ? (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Saved &#10003;
            </span>
          ) : confirmState === "saving" ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span
                className="inline-block size-3 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin"
                aria-hidden="true"
              />
              Saving...
            </span>
          ) : confirmState === "error" ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="text-sm font-medium text-destructive underline underline-offset-2"
            >
              Failed to save — try again
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={handleEdit}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageBubble({ message, onSendMessage }: MessageBubbleProps) {
  // ---- Case A: Structured assessment card ----
  if (message.type === "card" && message.card) {
    return (
      <AssessmentCard
        card={message.card}
        {...(onSendMessage !== undefined ? { onSendMessage } : {})}
      />
    );
  }

  const isUser = message.role === "user";

  // ---- User message: green pill, right-aligned ----
  if (isUser) {
    return (
      <div
        className="flex w-full justify-end px-4 py-1.5"
        aria-label="You said:"
      >
        <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground sm:max-w-[75%]">
          {message.imageUrls && message.imageUrls.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.imageUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={`/api/img?url=${encodeURIComponent(url)}`}
                  alt={`Submitted item ${i + 1}`}
                  className="max-w-[280px] rounded-lg object-contain sm:max-w-[400px]"
                />
              ))}
            </div>
          )}
          <div className="whitespace-pre-wrap text-base leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // ---- Case B: Assistant prose message — soft bubble, left-aligned ----
  return (
    <div
      className="flex w-full justify-start px-4 py-1.5"
      aria-label="Aisling said:"
    >
      <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-muted/40 sm:max-w-[75%]">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {renderInlineFormatting(message.content)}
        </div>
      </div>
    </div>
  );
}
