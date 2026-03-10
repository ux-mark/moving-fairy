"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EditPanel,
  Button,
  Spinner,
} from "@thefairies/design-system/components";

import { cn } from "@/lib/utils";
import type { Country, OnwardTimeline } from "@/lib/constants";
import {
  getSupportedCountries,
  getCountryName,
  hasVoltageChange,
} from "@/lib/countries";
import type { UserProfile, Equipment } from "@/types/database";
import styles from "./ProfileEditPanel.module.css";

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
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function ProfileEditPanel({
  open,
  onClose,
  onSaved,
  triggerRef,
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
    <EditPanel
      isOpen={open}
      onClose={onClose}
      title="Edit move details"
      onSave={handleSave}
      onCancel={onClose}
      saveLabel={isSaving ? "Saving..." : success ? "Saved" : "Save changes"}
      footer={false}
      triggerRef={triggerRef}
    >
      {isLoading ? (
        <div className={styles.loadingWrapper}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={styles.form}>
          {/* Departure country */}
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Moving from</span>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="sr-only">Departure country</legend>
              <div className={styles.optionGrid}>
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setDepartureCountry(country.code);
                      if (arrivalCountry === country.code)
                        setArrivalCountry(null);
                      if (onwardCountry === country.code)
                        setOnwardCountry(null);
                    }}
                    className={cn(
                      styles.optionButton,
                      departureCountry === country.code &&
                        styles.optionButtonSelected
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
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Moving to</span>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="sr-only">Arrival country</legend>
              <div className={styles.optionGrid}>
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
                      styles.optionButton,
                      arrivalCountry === country.code &&
                        styles.optionButtonSelected
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
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Planning an onward move?</span>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="sr-only">Onward move plans</legend>
              <div className={styles.optionGrid}>
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
                      styles.optionButton,
                      onwardIntent === option.value &&
                        styles.optionButtonSelected
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
            <div className={styles.onwardDetails}>
              <div className={styles.fieldGroup}>
                <span className={styles.label}>Onward country</span>
                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className="sr-only">Onward country</legend>
                  <div className={styles.optionGrid}>
                    {availableOnwardCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => setOnwardCountry(country.code)}
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

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Timeline</span>
                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className="sr-only">Onward timeline</legend>
                  <div className={styles.optionGrid}>
                    {TIMELINE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOnwardTimeline(option.value)}
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

          {/* Transformer */}
          {showTransformer && (
            <div className={styles.fieldGroup}>
              <span className={styles.label}>Voltage transformer</span>
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend className="sr-only">
                  Do you own a voltage transformer?
                </legend>
                <div className={styles.optionGrid}>
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
                        styles.optionButton,
                        hasTransformer === option.value &&
                          styles.optionButtonSelected
                      )}
                      aria-pressed={hasTransformer === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {hasTransformer && (
                <div className={styles.transformerFields}>
                  <div className={styles.inputGroup}>
                    <label
                      htmlFor="edit-transformer-model"
                      className={styles.inputLabel}
                    >
                      Model (optional)
                    </label>
                    <input
                      id="edit-transformer-model"
                      value={transformerModel}
                      onChange={(e) => setTransformerModel(e.target.value)}
                      placeholder="e.g. Dynastar DS-5500"
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label
                      htmlFor="edit-transformer-wattage"
                      className={styles.inputLabel}
                    >
                      Wattage (optional)
                    </label>
                    <div className={styles.wattageRow}>
                      <input
                        id="edit-transformer-wattage"
                        type="number"
                        value={transformerWattage}
                        onChange={(e) =>
                          setTransformerWattage(e.target.value)
                        }
                        placeholder="e.g. 5500"
                        className={cn(styles.input, styles.wattageInput)}
                      />
                      <span className={styles.wattageUnit}>watts</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className={styles.successBanner} role="status">
              <p className={styles.successText}>Move details saved</p>
            </div>
          )}

          {/* Save button */}
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={
              isSaving || !departureCountry || !arrivalCountry || success
            }
            className={styles.saveButton ?? ""}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" />
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
    </EditPanel>
  );
}
