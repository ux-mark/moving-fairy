"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TransformerStepProps {
  hasTransformer: boolean | null;
  model: string;
  wattage: string;
  onHasTransformerChange: (has: boolean) => void;
  onModelChange: (model: string) => void;
  onWattageChange: (wattage: string) => void;
}

export function TransformerStep({
  hasTransformer,
  model,
  wattage,
  onHasTransformerChange,
  onModelChange,
  onWattageChange,
}: TransformerStepProps) {
  const options = [
    { value: true, label: "Yes, I have one" },
    { value: false, label: "No" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-base leading-relaxed text-foreground">
          &ldquo;One more thing — do you own a voltage transformer?&rdquo;
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If you have one, it changes what electrical items are worth bringing.
          If you don&rsquo;t, no worries — I&rsquo;ll advise accordingly.
        </p>
        <p className="mt-1 text-sm text-primary font-medium">— Aisling</p>
      </div>

      <fieldset>
        <legend className="sr-only">Do you own a voltage transformer?</legend>
        <div className="grid gap-3">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onHasTransformerChange(option.value)}
              className={cn(
                "flex min-h-[48px] items-center rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors",
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

      {/* Conditional microcopy */}
      {hasTransformer === true && model && (
        <p className="text-sm leading-relaxed text-muted-foreground italic">
          &ldquo;Nice — that&rsquo;ll open up your options for kitchen
          appliances.&rdquo;
        </p>
      )}
      {hasTransformer === false && (
        <p className="text-sm leading-relaxed text-muted-foreground italic">
          &ldquo;That&rsquo;s grand. I&rsquo;ll only recommend bringing things
          that&rsquo;ll work on local power.&rdquo;
        </p>
      )}

      {hasTransformer === true && (
        <div
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="transformer-model">Model (optional)</Label>
            <Input
              id="transformer-model"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="e.g. Dynastar DS-5500"
              className="h-12"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="transformer-wattage">Wattage (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="transformer-wattage"
                type="number"
                value={wattage}
                onChange={(e) => onWattageChange(e.target.value)}
                placeholder="e.g. 5500"
                className="h-12"
              />
              <span className="text-sm text-muted-foreground">watts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
