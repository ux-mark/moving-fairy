"use client";

import type { Country, OnwardTimeline } from "@/lib/constants";
import { getCountryName, getSupportedCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-base leading-relaxed text-foreground">
          &ldquo;Some people use {arrivalName} as a stepping stone. Are you
          planning to move somewhere else after?&rdquo;
        </p>
        <p className="mt-1 text-sm text-primary font-medium">— Aisling</p>
      </div>

      <fieldset>
        <legend className="sr-only">Onward move plans</legend>
        <div className="grid gap-3">
          {intentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onIntentChange(option.value)}
              className={cn(
                "flex min-h-[48px] items-center rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors",
                intent === option.value
                  ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                  : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
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
        <p className="text-sm leading-relaxed text-muted-foreground italic">
          &ldquo;Good to know — that changes what&rsquo;s worth shipping.
          I&rsquo;ll factor both legs into my advice.&rdquo;
        </p>
      )}
      {intent === "maybe" && (
        <p className="text-sm leading-relaxed text-muted-foreground italic">
          &ldquo;No worries, I&rsquo;ll keep it in mind. Better to plan for it
          than get caught out.&rdquo;
        </p>
      )}

      {showSubQuestions && (
        <div
          className="flex flex-col gap-6"
        >
          {/* Onward country */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              Where are you thinking of moving next?
            </p>
            <fieldset>
              <legend className="sr-only">Onward country</legend>
              <div className="grid gap-3">
                {availableCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => onCountryChange(country.code)}
                    className={cn(
                      "flex min-h-[48px] items-center rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors",
                      onwardCountry === country.code
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
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
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              When are you thinking about that move?
            </p>
            <fieldset>
              <legend className="sr-only">Onward timeline</legend>
              <div className="grid gap-3">
                {TIMELINE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onTimelineChange(option.value)}
                    className={cn(
                      "flex min-h-[48px] items-center rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors",
                      onwardTimeline === option.value
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
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
