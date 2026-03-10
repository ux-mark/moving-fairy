"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { SlidePanel } from "@/components/shared/SlidePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Country, OnwardTimeline } from "@/lib/constants";
import {
  getSupportedCountries,
  getCountryName,
  hasVoltageChange,
} from "@/lib/countries";
import type { UserProfile, Equipment } from "@/types/database";

type OnwardIntent = "yes" | "maybe" | "no";

const TIMELINE_OPTIONS: { value: OnwardTimeline; label: string }[] = [
  { value: "1_2yr", label: "Within 1\u20132 years" },
  { value: "3_5yr", label: "3\u20135 years from now" },
  { value: "5yr_plus", label: "5+ years away" },
  { value: "undecided", label: "Not sure yet" },
];

interface ProfileEditPanelProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ProfileEditPanel({
  open,
  onClose,
  onSaved,
}: ProfileEditPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [departureCountry, setDepartureCountry] = useState<Country | null>(
    null
  );
  const [arrivalCountry, setArrivalCountry] = useState<Country | null>(null);
  const [onwardIntent, setOnwardIntent] = useState<OnwardIntent>("no");
  const [onwardCountry, setOnwardCountry] = useState<Country | null>(null);
  const [onwardTimeline, setOnwardTimeline] = useState<OnwardTimeline | null>(
    null
  );
  const [hasTransformer, setHasTransformer] = useState<boolean>(false);
  const [transformerModel, setTransformerModel] = useState("");
  const [transformerWattage, setTransformerWattage] = useState("");

  // Load current profile when panel opens
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok || !data.profile) {
          setError("Could not load your profile.");
          return;
        }
        const p = data.profile as UserProfile;
        setDepartureCountry(p.departure_country);
        setArrivalCountry(p.arrival_country);

        if (p.onward_country) {
          setOnwardIntent("yes");
          setOnwardCountry(p.onward_country);
          setOnwardTimeline(p.onward_timeline);
        } else {
          setOnwardIntent("no");
          setOnwardCountry(null);
          setOnwardTimeline(null);
        }

        const transformer = (p.equipment as Equipment)?.transformer;
        if (transformer?.owned) {
          setHasTransformer(true);
          setTransformerModel(transformer.model ?? "");
          setTransformerWattage(
            transformer.wattage_w ? String(transformer.wattage_w) : ""
          );
        } else {
          setHasTransformer(false);
          setTransformerModel("");
          setTransformerWattage("");
        }
      })
      .catch(() => setError("Could not load your profile."))
      .finally(() => setIsLoading(false));
  }, [open]);

  const countries = getSupportedCountries();

  const availableArrivalCountries = countries.filter(
    (c) => c.code !== departureCountry
  );
  const availableOnwardCountries = countries.filter(
    (c) => c.code !== departureCountry && c.code !== arrivalCountry
  );

  const showTransformer =
    departureCountry &&
    arrivalCountry &&
    hasVoltageChange(
      departureCountry,
      [arrivalCountry, ...(onwardCountry ? [onwardCountry] : [])].filter(
        Boolean
      ) as Country[]
    );

  const showOnwardDetails = onwardIntent === "yes" || onwardIntent === "maybe";

  const handleSave = useCallback(async () => {
    if (!departureCountry || !arrivalCountry) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const equipment: Equipment = {
      transformer: {
        owned: hasTransformer,
        model: hasTransformer && transformerModel ? transformerModel : null,
        wattage_w:
          hasTransformer && transformerWattage
            ? Number(transformerWattage)
            : null,
      },
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departure_country: departureCountry,
          arrival_country: arrivalCountry,
          onward_country: showOnwardDetails ? onwardCountry : null,
          onward_timeline: showOnwardDetails ? onwardTimeline : null,
          equipment,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong saving your changes.");
        return;
      }

      setSuccess(true);
      onSaved?.();

      // Auto-close after a brief moment so the user sees confirmation
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1200);
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    departureCountry,
    arrivalCountry,
    onwardCountry,
    onwardTimeline,
    hasTransformer,
    transformerModel,
    transformerWattage,
    showOnwardDetails,
    onClose,
    onSaved,
  ]);

  return (
    <SlidePanel open={open} onClose={onClose} title="Edit move details">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-6">
          {/* Departure country */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Moving from</Label>
            <fieldset>
              <legend className="sr-only">Departure country</legend>
              <div className="grid gap-2">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setDepartureCountry(country.code);
                      // Reset arrival if it conflicts
                      if (arrivalCountry === country.code)
                        setArrivalCountry(null);
                      if (onwardCountry === country.code)
                        setOnwardCountry(null);
                    }}
                    className={cn(
                      "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                      departureCountry === country.code
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                    aria-pressed={departureCountry === country.code}
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Arrival country */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Moving to</Label>
            <fieldset>
              <legend className="sr-only">Arrival country</legend>
              <div className="grid gap-2">
                {availableArrivalCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setArrivalCountry(country.code);
                      if (onwardCountry === country.code)
                        setOnwardCountry(null);
                    }}
                    className={cn(
                      "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                      arrivalCountry === country.code
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                    aria-pressed={arrivalCountry === country.code}
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Onward move */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Planning an onward move?</Label>
            <fieldset>
              <legend className="sr-only">Onward move plans</legend>
              <div className="grid gap-2">
                {(
                  [
                    { value: "yes", label: "Yes" },
                    { value: "maybe", label: "Maybe" },
                    {
                      value: "no",
                      label: `No, ${arrivalCountry ? getCountryName(arrivalCountry) : "there"} is my destination`,
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setOnwardIntent(option.value);
                      if (option.value === "no") {
                        setOnwardCountry(null);
                        setOnwardTimeline(null);
                      }
                    }}
                    className={cn(
                      "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                      onwardIntent === option.value
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                    aria-pressed={onwardIntent === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Onward details */}
          {showOnwardDetails && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Onward country</Label>
                <fieldset>
                  <legend className="sr-only">Onward country</legend>
                  <div className="grid gap-2">
                    {availableOnwardCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => setOnwardCountry(country.code)}
                        className={cn(
                          "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
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

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Timeline</Label>
                <fieldset>
                  <legend className="sr-only">Onward timeline</legend>
                  <div className="grid gap-2">
                    {TIMELINE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOnwardTimeline(option.value)}
                        className={cn(
                          "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
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

          {/* Transformer */}
          {showTransformer && (
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">
                Voltage transformer
              </Label>
              <fieldset>
                <legend className="sr-only">
                  Do you own a voltage transformer?
                </legend>
                <div className="grid gap-2">
                  {(
                    [
                      { value: true, label: "Yes, I have one" },
                      { value: false, label: "No" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => {
                        setHasTransformer(option.value);
                        if (!option.value) {
                          setTransformerModel("");
                          setTransformerWattage("");
                        }
                      }}
                      className={cn(
                        "flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                        hasTransformer === option.value
                          ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                      )}
                      aria-pressed={hasTransformer === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {hasTransformer && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-transformer-model" className="text-sm">
                      Model (optional)
                    </Label>
                    <Input
                      id="edit-transformer-model"
                      value={transformerModel}
                      onChange={(e) => setTransformerModel(e.target.value)}
                      placeholder="e.g. Dynastar DS-5500"
                      className="h-11"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="edit-transformer-wattage"
                      className="text-sm"
                    >
                      Wattage (optional)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="edit-transformer-wattage"
                        type="number"
                        value={transformerWattage}
                        onChange={(e) => setTransformerWattage(e.target.value)}
                        placeholder="e.g. 5500"
                        className="h-11"
                      />
                      <span className="text-sm text-muted-foreground">
                        watts
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2" role="alert">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-lg bg-primary/10 px-3 py-2" role="status">
              <p className="text-sm font-medium text-primary">
                Move details saved
              </p>
            </div>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={isSaving || !departureCountry || !arrivalCountry || success}
            className="h-11 w-full text-sm font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : success ? (
              "Saved"
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      )}
    </SlidePanel>
  );
}
