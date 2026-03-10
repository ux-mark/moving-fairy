"use client";

import { cn } from "@/lib/utils";
import styles from "./step.module.css";

interface TransformerStepProps {
  hasTransformer: boolean | null;
  model: string;
  wattage: string;
  onHasTransformerChange: (has: boolean) => void;
  onModelChange: (model: string) => void;
  onWattageChange: (wattage: string) => void;
}

const options = [
  { value: true, label: "Yes, I have one" },
  { value: false, label: "No" },
] as const;

export function TransformerStep({
  hasTransformer,
  model,
  wattage,
  onHasTransformerChange,
  onModelChange,
  onWattageChange,
}: TransformerStepProps) {
  return (
    <div className={styles.step}>
      <div className={styles.prompt}>
        <p className={styles.promptQuote}>
          &ldquo;One more thing — do you own a voltage transformer?&rdquo;
        </p>
        <p className={styles.promptNote}>
          If you have one, it changes what electrical items are worth bringing.
          If you don&rsquo;t, no worries — I&rsquo;ll advise accordingly.
        </p>
        <p className={styles.promptAuthor}>— Aisling</p>
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend className="sr-only">Do you own a voltage transformer?</legend>
        <div className={styles.optionGrid}>
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onHasTransformerChange(option.value)}
              className={cn(
                styles.optionButton,
                hasTransformer === option.value && styles.optionButtonSelected
              )}
              aria-pressed={hasTransformer === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Conditional microcopy */}
      {hasTransformer === true && model && (
        <p className={styles.microcopy}>
          &ldquo;Nice — that&rsquo;ll open up your options for kitchen
          appliances.&rdquo;
        </p>
      )}
      {hasTransformer === false && (
        <p className={styles.microcopy}>
          &ldquo;That&rsquo;s grand. I&rsquo;ll only recommend bringing things
          that&rsquo;ll work on local power.&rdquo;
        </p>
      )}

      {hasTransformer === true && (
        <div className={styles.subQuestions}>
          <div className={styles.inputGroup}>
            <label htmlFor="transformer-model" className={styles.inputLabel}>
              Model (optional)
            </label>
            <input
              id="transformer-model"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="e.g. Dynastar DS-5500"
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="transformer-wattage" className={styles.inputLabel}>
              Wattage (optional)
            </label>
            <div className={styles.wattageRow}>
              <input
                id="transformer-wattage"
                type="number"
                value={wattage}
                onChange={(e) => onWattageChange(e.target.value)}
                placeholder="e.g. 5500"
                className={cn(styles.input, styles.wattageInput)}
              />
              <span className={styles.wattageUnit}>watts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
