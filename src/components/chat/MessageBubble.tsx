"use client";

import { useState } from "react";
import { RecommendationCard, type RecommendationStatus } from "@thefairies/design-system/components";
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
  currency?: string;
  estimated_replace_cost_usd?: number;
  replace_currency?: string;
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
// Verdict → DS accent colour (for RecommendationCard left border)
// ---------------------------------------------------------------------------

const VERDICT_ACCENT: Record<string, string> = {
  SHIP: "var(--verdict-ship)",
  CARRY: "var(--verdict-carry)",
  SELL: "var(--verdict-sell)",
  DONATE: "var(--verdict-donate)",
  DISCARD: "var(--verdict-discard)",
  DECIDE_LATER: "var(--verdict-decide-later)",
};

// Verdict → DS badge colour (solid bg for RecommendationCard badge)
const VERDICT_BADGE_COLOR: Record<string, string> = {
  SHIP: "var(--verdict-ship)",
  CARRY: "var(--verdict-carry)",
  SELL: "var(--verdict-sell)",
  DONATE: "var(--verdict-donate)",
  DISCARD: "var(--verdict-discard)",
  DECIDE_LATER: "var(--verdict-decide-later)",
};

// ---------------------------------------------------------------------------
// Assessment Card — uses DS RecommendationCard
// ---------------------------------------------------------------------------

function AssessmentCard({
  card,
  onSendMessage,
}: {
  card: CardData;
  onSendMessage?: (text: string) => void;
}) {
  const verdictNormalised = card.verdict.replace(/\s+/g, "_").toUpperCase();
  const isValidVerdict = verdictNormalised in Verdict;

  // Map local confirm state to DS RecommendationStatus
  const [confirmState, setConfirmState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const dsStatus: RecommendationStatus = (() => {
    switch (confirmState) {
      case "saving": return "confirming";
      case "saved": return "confirmed";
      case "error": return "error";
      default: return "idle";
    }
  })();

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
          currency: card.currency,
          estimated_replace_cost: card.estimated_replace_cost_usd,
          replace_currency: card.replace_currency,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setConfirmState("saved");
    } catch {
      setConfirmState("error");
    }
  }

  function handleSkip() {
    // "Skip" in this context means "Edit" — ask Aisling to revise
    onSendMessage?.(`Please revise your assessment for ${card.item}`);
  }

  // Build metadata array for shipping / replace cost
  const metadata: { label: string; value: string }[] = [];
  if (card.estimated_ship_cost_usd != null) {
    const sym = card.currency ?? "USD";
    metadata.push({
      label: "Ship cost",
      value: `${sym} ${card.estimated_ship_cost_usd.toFixed(2)}`,
    });
  }
  if (card.estimated_replace_cost_usd != null) {
    const sym = card.replace_currency ?? "USD";
    metadata.push({
      label: "Replace cost",
      value: `${sym} ${card.estimated_replace_cost_usd.toFixed(2)}`,
    });
  }

  // Build optional prop groups to satisfy exactOptionalPropertyTypes
  const optionalProps = {
    ...(isValidVerdict
      ? {
          badge: {
            label: verdictNormalised.replace("_", " "),
            color: VERDICT_BADGE_COLOR[verdictNormalised] ?? "var(--color-primary)",
          },
        }
      : {}),
    ...(card.import_note !== undefined ? { warning: card.import_note } : {}),
    ...(metadata.length > 0 ? { metadata } : {}),
    ...(VERDICT_ACCENT[verdictNormalised] !== undefined
      ? { accentColor: VERDICT_ACCENT[verdictNormalised] }
      : {}),
  };

  return (
    <div className="mx-4 my-2">
      <RecommendationCard
        title={card.item}
        rationale={card.rationale}
        confidence={card.confidence}
        action={card.action}
        status={dsStatus}
        onConfirm={handleConfirm}
        onSkip={handleSkip}
        confirmLabel="Confirm"
        skipLabel="Edit"
        errorMessage="Failed to save — try again"
        ariaLabel={`Assessment for ${card.item}`}
        {...optionalProps}
      />
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
