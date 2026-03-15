"use client";

import type { Country } from "@/lib/constants";
import { getSupportedCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import styles from "./step.module.css";

interface DepartureStepProps {
  value: Country | null;
  onChange: (country: Country) => void;
}

export function DepartureStep({ value, onChange }: DepartureStepProps) {
  const countries = getSupportedCountries();

  return (
    <div className={styles.step}>
      <div className={styles.prompt}>
        <p className={styles.promptQuote}>
          &ldquo;First things first — where are you moving from?&rdquo;
        </p>
        <p className={styles.promptAuthor}>— Aisling</p>
      </div>

      <fieldset className="fieldsetReset">
        <legend className="srOnly">Departure country</legend>
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
