"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKeyStepProps {
  value: string;
  onChange: (key: string) => void;
}

export function ApiKeyStep({ value, onChange }: ApiKeyStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-base leading-relaxed text-foreground">
          &ldquo;Last thing — I need your Anthropic API key so I can get to
          work.&rdquo;
        </p>
        <p className="mt-1 text-sm text-primary font-medium">— Aisling</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key">Anthropic API key</Label>
        <Input
          id="api-key"
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-ant-..."
          className="h-12 font-mono text-sm"
          autoComplete="off"
        />
        <p className="text-sm text-muted-foreground">
          Get yours free at{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            console.anthropic.com
          </a>{" "}
          — this is separate from a claude.ai subscription.
        </p>
      </div>
    </div>
  );
}
