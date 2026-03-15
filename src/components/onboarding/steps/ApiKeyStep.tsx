"use client";

import { cn } from "@/lib/utils";
import styles from "./step.module.css";

interface ApiKeyStepProps {
  value: string;
  onChange: (key: string) => void;
}

export function ApiKeyStep({ value, onChange }: ApiKeyStepProps) {
  return (
    <div className={styles.step}>
      <div className={styles.prompt}>
        <p className={styles.promptQuote}>
          &ldquo;Last thing — I need your Anthropic API key so I can get to
          work.&rdquo;
        </p>
        <p className={styles.promptAuthor}>— Aisling</p>
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="api-key" className={styles.inputLabel}>
          Anthropic API key
        </label>
        <input
          id="api-key"
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-ant-..."
          className={cn(styles.input, styles.inputMono)}
          autoComplete="off"
        />
        <p className={styles.apiKeyNote}>
          Get yours free at{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.apiKeyLink}
          >
            console.anthropic.com
          </a>{" "}
          — this is separate from a claude.ai subscription.
        </p>
      </div>
    </div>
  );
}
