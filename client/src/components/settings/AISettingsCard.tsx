import { useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAIConfig, useResetAffinity, useSetAIConfig } from "../../api/hooks";

export function AISettingsCard() {
  const { data } = useAIConfig();
  const setConfig = useSetAIConfig();
  const resetAffinity = useResetAffinity();
  const [apiKey, setApiKey] = useState("");

  function save() {
    if (!apiKey.trim()) return;
    setConfig.mutate(apiKey.trim(), { onSuccess: () => setApiKey("") });
  }

  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Sparkles size={15} className="text-violet-500" /> AI suggestions
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        A local scoring engine always ranks backlog allocations instantly, even offline. Add a Claude API key to also
        get narrative digests and richer per-task recommendations — it's used only to enhance suggestions and never
        required.
      </p>

      <div className="mb-3 flex items-center gap-1.5 text-sm">
        {data?.configured ? (
          <>
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span className="text-slate-700">Claude-enhanced insights are active.</span>
          </>
        ) : (
          <span className="text-slate-500">Running local-only — no API key configured.</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          className="min-w-[200px] flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <Button onClick={save} disabled={!apiKey.trim() || setConfig.isPending} className="shrink-0">
          {data?.configured ? "Update key" : "Enable"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Stored only in this server's local .env file — never sent anywhere except Anthropic's API.
      </p>

      <div className="mt-4 border-t border-surface-border pt-3">
        <p className="mb-2 text-xs text-slate-500">
          If suggestions keep favoring the same person, the local engine's learned history may be skewed — clear it
          and it'll rebuild from scratch as tasks are completed and suggestions accepted.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => confirm("Reset all learned suggestion history?") && resetAffinity.mutate()}
          disabled={resetAffinity.isPending}
        >
          <RotateCcw size={13} /> Reset learned suggestions
        </Button>
      </div>
    </Card>
  );
}
