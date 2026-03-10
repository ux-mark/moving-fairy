"use client";

import type { Country } from "@/lib/constants";
import { getSupportedCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface DepartureStepProps {
  value: Country | null;
  onChange: (country: Country) => void;
}

export function DepartureStep({ value, onChange }: DepartureStepProps) {
  const countries = getSupportedCountries();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-base leading-relaxed text-foreground">
          &ldquo;First things first — where are you moving from?&rdquo;
        </p>
        <p className="mt-1 text-sm text-primary font-medium">— Aisling</p>
      </div>

      <fieldset>
        <legend className="sr-only">Departure country</legend>
        <div className="grid gap-3">
          {countries.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => onChange(country.code)}
              className={cn(
                "flex min-h-[48px] items-center rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors",
                value === country.code
                  ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                  : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
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
