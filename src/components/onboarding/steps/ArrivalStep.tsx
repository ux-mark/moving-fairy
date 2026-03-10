"use client";

import type { Country } from "@/lib/constants";
import { getSupportedCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import styles from "./step.module.css";

interface ArrivalStepProps {
  value: Country | null;
  departure: Country | null;
  onChange: (country: Country) => void;
}

export function ArrivalStep({ value, departure, onChange }: ArrivalStepProps) {
  const countries = getSupportedCountries().filter(
    (c) => c.code !== departure
  );

  return (
    <div className={styles.step}>
      <div className={styles.prompt}>
        <p className={styles.promptQuote}>
          &ldquo;And where are you headed?&rdquo;
        </p>
        <p className={styles.promptAuthor}>— Aisling</p>
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend className="srOnly">Destination country</legend>
        <div className={styles.optionGrid}>
          {countries.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => onChange(country.code)}
              className={cn(
                styles.optionButton,
                value === country.code && styles.optionButtonSelected
              )}
              aria-pressed={value === country.code}
            >
              {country.name}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
