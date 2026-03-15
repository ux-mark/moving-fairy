"use client";

import type { Country, OnwardTimeline } from "@/lib/constants";
import { getCountryName, getSupportedCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import styles from "./step.module.css";

type OnwardIntent = "yes" | "maybe" | "no";

interface OnwardStepProps {
  arrivalCountry: Country | null;
  departureCountry: Country | null;
  intent: OnwardIntent | null;
  onwardCountry: Country | null;
  onwardTimeline: OnwardTimeline | null;
  onIntentChange: (intent: OnwardIntent) => void;
  onCountryChange: (country: Country) => void;
  onTimelineChange: (timeline: OnwardTimeline) => void;
}

const TIMELINE_OPTIONS: { value: OnwardTimeline; label: string }[] = [
  { value: "1_2yr", label: "Within 1\u20132 years" },
  { value: "3_5yr", label: "3\u20135 years from now" },
  { value: "5yr_plus", label: "5+ years away" },
  { value: "undecided", label: "Not sure yet" },
];

export function OnwardStep({
  arrivalCountry,
  departureCountry,
  intent,
  onwardCountry,
  onwardTimeline,
  onIntentChange,
  onCountryChange,
  onTimelineChange,
}: OnwardStepProps) {
  const arrivalName = arrivalCountry ? getCountryName(arrivalCountry) : "there";
  const showSubQuestions = intent === "yes" || intent === "maybe";

  const availableCountries = getSupportedCountries().filter(
    (c) => c.code !== departureCountry && c.code !== arrivalCountry
  );

  const intentOptions: { value: OnwardIntent; label: string }[] = [
    { value: "yes", label: "Yes, I have a plan" },
    { value: "maybe", label: "Maybe \u2014 I\u2019m thinking about it" },
    {
      value: "no",
      label: `No, ${arrivalName} is my final destination`,
    },
  ];

  return (
    <div className={styles.step}>
      <div className={styles.prompt}>
        <p className={styles.promptQuote}>
          &ldquo;Some people use {arrivalName} as a stepping stone. Are you
          planning to move somewhere else after?&rdquo;
        </p>
        <p className={styles.promptAuthor}>— Aisling</p>
      </div>

      <fieldset className="fieldsetReset">
        <legend className="srOnly">Onward move plans</legend>
        <div className={styles.optionGrid}>
          {intentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onIntentChange(option.value)}
              className={cn(
                styles.optionButton,
                intent === option.value && styles.optionButtonSelected
              )}
              aria-pressed={intent === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Aisling's conditional microcopy */}
      {intent === "yes" && (
        <p className={styles.microcopy}>
          &ldquo;Good to know — that changes what&rsquo;s worth shipping.
          I&rsquo;ll factor both legs into my advice.&rdquo;
        </p>
      )}
      {intent === "maybe" && (
        <p className={styles.microcopy}>
          &ldquo;No worries, I&rsquo;ll keep it in mind. Better to plan for it
          than get caught out.&rdquo;
        </p>
      )}

      {showSubQuestions && (
        <div className={styles.subQuestions}>
          {/* Onward country */}
          <div className={styles.subQuestion}>
            <p className={styles.subQuestionLabel}>
              Where are you thinking of moving next?
            </p>
            <fieldset className="fieldsetReset">
              <legend className="srOnly">Onward country</legend>
              <div className={styles.optionGrid}>
                {availableCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => onCountryChange(country.code)}
                    className={cn(
                      styles.optionButton,
                      onwardCountry === country.code &&
                        styles.optionButtonSelected
                    )}
                    aria-pressed={onwardCountry === country.code}
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Timeline */}
          <div className={styles.subQuestion}>
            <p className={styles.subQuestionLabel}>
              When are you thinking about that move?
            </p>
            <fieldset className="fieldsetReset">
              <legend className="srOnly">Onward timeline</legend>
              <div className={styles.optionGrid}>
                {TIMELINE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onTimelineChange(option.value)}
                    className={cn(
                      styles.optionButton,
                      onwardTimeline === option.value &&
                        styles.optionButtonSelected
                    )}
                    aria-pressed={onwardTimeline === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
}
