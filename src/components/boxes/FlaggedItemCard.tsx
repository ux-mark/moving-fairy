"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@thefairies/design-system/components";

import { cn } from "@/lib/utils";
import styles from "./FlaggedItemCard.module.css";

interface FlaggedItemCardProps {
  itemName: string;
  itemId: string;
  verdict: "SELL" | "DONATE" | "DISCARD" | "REVISIT";
  boxId: string;
  boxLabel: string;
  onShipAnyway: (itemId: string, boxId: string) => void;
  onRemoveFromBox: (itemId: string, boxId: string) => void;
  isResolving?: boolean;
}

const VERDICT_MESSAGES: Record<FlaggedItemCardProps["verdict"], string> = {
  SELL: "This item was assessed as sell -- shipping it would cost more than it is worth. Are you sure?",
  DONATE: "This item was assessed as donate. Are you sure you want to ship it?",
  DISCARD: "This item was assessed as discard. Are you sure you want to ship it?",
  REVISIT: "This item still needs review. Chat with Aisling to decide before packing it.",
};

const VERDICT_LABELS: Record<FlaggedItemCardProps["verdict"], string> = {
  SELL: "sell",
  DONATE: "donate",
  DISCARD: "discard",
  REVISIT: "revisit",
};

export function FlaggedItemCard({
  itemName,
  itemId,
  verdict,
  boxId,
  boxLabel,
  onShipAnyway,
  onRemoveFromBox,
  isResolving = false,
}: FlaggedItemCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const borderColorClass =
    verdict === "SELL"
      ? styles.borderSell
      : styles.borderMuted;

  return (
    <motion.div
      className={cn(styles.card, borderColorClass)}
      role="group"
      aria-label={`Warning: ${itemName} assessed as ${VERDICT_LABELS[verdict]}`}
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
    >
      <div className={styles.header}>
        <AlertTriangle
          className={styles.icon}
          style={{ width: 16, height: 16 }}
          aria-hidden
        />
        <span className={styles.itemName}>{itemName}</span>
      </div>

      <p className={styles.message}>{VERDICT_MESSAGES[verdict]}</p>

      <div className={styles.actions}>
        <Button
          variant="outline"
          size="sm"
          className={cn(styles.actionButton)}
          onClick={(e) => {
            e.stopPropagation();
            onShipAnyway(itemId, boxId);
          }}
          disabled={isResolving}
          aria-label={`Ship ${itemName} anyway`}
        >
          {isResolving ? (
            <span className={styles.resolvingLabel}>Updating...</span>
          ) : (
            "Ship it anyway"
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(styles.actionButton)}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromBox(itemId, boxId);
          }}
          disabled={isResolving}
          aria-label={`Remove ${itemName} from ${boxLabel}`}
        >
          Remove from box
        </Button>

        <Link
          href={`/decisions/${itemId}?from=boxes`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Ask Aisling about ${itemName}`}
          className={cn(styles.actionButton, styles.askAislingLink, isResolving && styles.disabledLink)}
          aria-disabled={isResolving}
          tabIndex={isResolving ? -1 : undefined}
        >
          Ask Aisling
        </Link>
      </div>
    </motion.div>
  );
}
