"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { OnboardingWizard as DSOnboardingWizard } from "@thefairies/design-system/components";

import type { Country, OnwardTimeline } from "@/lib/constants";
import { hasVoltageChange } from "@/lib/countries";

import { DepartureStep } from "./steps/DepartureStep";
import { ArrivalStep } from "./steps/ArrivalStep";
import { OnwardStep } from "./steps/OnwardStep";
import { TransformerStep } from "./steps/TransformerStep";
import { ApiKeyStep } from "./steps/ApiKeyStep";
import stepStyles from "./steps/step.module.css";

type OnwardIntent = "yes" | "maybe" | "no";

interface FormData {
  departure: Country | null;
  arrival: Country | null;
  onwardIntent: OnwardIntent | null;
  onwardCountry: Country | null;
  onwardTimeline: OnwardTimeline | null;
  hasTransformer: boolean | null;
  transformerModel: string;
  transformerWattage: string;
  apiKey: string;
}

type StepId = "departure" | "arrival" | "onward" | "transformer" | "api-key";

export function OnboardingWizard() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    departure: "US",
    arrival: null,
    onwardIntent: null,
    onwardCountry: null,
    onwardTimeline: null,
    hasTransformer: null,
    transformerModel: "",
    transformerWattage: "",
    apiKey: "",
  });

  // When NEXT_PUBLIC_HAS_LOCAL_KEY=true (local dev with Claude Code subscription),
  // skip the API key step — the key is already in the server environment.
  const hasLocalKey = process.env.NEXT_PUBLIC_HAS_LOCAL_KEY === "true";

  // Determine which steps are active based on form state
  const steps = useMemo<StepId[]>(() => {
    const base: StepId[] = ["departure", "arrival", "onward"];

    // Only show transformer step if there's a voltage change
    if (form.departure && form.arrival) {
      const destinations = [form.arrival];
      if (form.onwardCountry) destinations.push(form.onwardCountry);
      if (hasVoltageChange(form.departure, destinations)) {
        base.push("transformer");
      }
    }

    if (!hasLocalKey) base.push("api-key");
    return base;
  }, [form.departure, form.arrival, form.onwardCountry, hasLocalKey]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const canAdvance = useCallback((): boolean => {
    switch (currentStep) {
      case "departure":
        return form.departure !== null;
      case "arrival":
        return form.arrival !== null;
      case "onward":
        if (form.onwardIntent === null) return false;
        if (form.onwardIntent === "no") return true;
        return form.onwardCountry !== null;
      case "transformer":
        return form.hasTransformer !== null;
      case "api-key":
        return hasLocalKey || form.apiKey.trim().length > 0;
      default:
        return false;
    }
  }, [currentStep, form, hasLocalKey]);

  const handleSubmit = useCallback(async () => {
    if (!canAdvance() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      departure_country: form.departure,
      arrival_country: form.arrival,
      anthropic_api_key: form.apiKey,
    };

    if (form.onwardIntent !== "no" && form.onwardCountry) {
      body.onward_country = form.onwardCountry;
      body.onward_timeline = form.onwardTimeline ?? "undecided";
    }

    if (form.hasTransformer !== null) {
      body.equipment = {
        transformer: {
          owned: form.hasTransformer,
          model: form.transformerModel || null,
          wattage_w: form.transformerWattage
            ? parseInt(form.transformerWattage, 10)
            : null,
        },
      };
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ?? `Something went wrong (${res.status})`
        );
      }

      router.push("/chat");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
      setIsSubmitting(false);
    }
  }, [canAdvance, form, isSubmitting, router]);

  const goNext = useCallback(() => {
    if (!canAdvance()) return;
    if (isLastStep) {
      void handleSubmit();
      return;
    }
    setDirection(1);
    setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  }, [canAdvance, isLastStep, handleSubmit, totalSteps]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const variants = prefersReducedMotion
    ? { enter: {}, center: {}, exit: {} }
    : {
        enter: (d: number) => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? -200 : 200, opacity: 0 }),
      };

  // DS OnboardingWizard uses 1-based currentStep
  const dsCurrentStep = currentStepIndex + 1;

  // Final step label: show submitting state via nextLabel + nextDisabled
  // Only pass nextLabel when we have a value — DS uses exactOptionalPropertyTypes
  const nextLabelProps = isLastStep
    ? {
        nextLabel: isSubmitting
          ? "Setting up..."
          : "Start chatting with Aisling",
      }
    : {}; // DS defaults to "Continue" when not provided

  return (
    <DSOnboardingWizard
      currentStep={dsCurrentStep}
      totalSteps={totalSteps}
      onBack={goBack}
      onNext={goNext}
      {...nextLabelProps}
      nextDisabled={!canAdvance() || isSubmitting}
    >
      {/* Step content with Framer Motion transitions */}
      <div className={stepStyles.stepContainer}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: "easeOut" }
            }
          >
            {currentStep === "departure" && (
              <DepartureStep
                value={form.departure}
                onChange={(c) =>
                  setForm((f) => ({
                    ...f,
                    departure: c,
                    arrival: f.arrival === c ? null : f.arrival,
                  }))
                }
              />
            )}
            {currentStep === "arrival" && (
              <ArrivalStep
                value={form.arrival}
                departure={form.departure}
                onChange={(c) => setForm((f) => ({ ...f, arrival: c }))}
              />
            )}
            {currentStep === "onward" && (
              <OnwardStep
                arrivalCountry={form.arrival}
                departureCountry={form.departure}
                intent={form.onwardIntent}
                onwardCountry={form.onwardCountry}
                onwardTimeline={form.onwardTimeline}
                onIntentChange={(i) =>
                  setForm((f) => ({
                    ...f,
                    onwardIntent: i,
                    onwardCountry: i === "no" ? null : f.onwardCountry,
                    onwardTimeline: i === "no" ? null : f.onwardTimeline,
                  }))
                }
                onCountryChange={(c) =>
                  setForm((f) => ({ ...f, onwardCountry: c }))
                }
                onTimelineChange={(t) =>
                  setForm((f) => ({ ...f, onwardTimeline: t }))
                }
              />
            )}
            {currentStep === "transformer" && (
              <TransformerStep
                hasTransformer={form.hasTransformer}
                model={form.transformerModel}
                wattage={form.transformerWattage}
                onHasTransformerChange={(h) =>
                  setForm((f) => ({ ...f, hasTransformer: h }))
                }
                onModelChange={(m) =>
                  setForm((f) => ({ ...f, transformerModel: m }))
                }
                onWattageChange={(w) =>
                  setForm((f) => ({ ...f, transformerWattage: w }))
                }
              />
            )}
            {currentStep === "api-key" && (
              <ApiKeyStep
                value={form.apiKey}
                onChange={(k) => setForm((f) => ({ ...f, apiKey: k }))}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error message */}
      {error && (
        <p className={stepStyles.errorBanner} role="alert">
          {error}
        </p>
      )}
    </DSOnboardingWizard>
  );
}
