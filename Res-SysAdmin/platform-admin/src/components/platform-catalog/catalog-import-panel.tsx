"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlatformCatalogItemsControllerImport,
  getPlatformCatalogItemsControllerListQueryKey,
} from "@/api/generated/endpoints/platform-catalog-items/platform-catalog-items";
import type { ImportCatalogItemsResponse } from "@/api/generated/model";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { STRINGS, buildTemplateCsv, actionTone } from "@/components/platform-catalog/strings";

/** Import panel lifecycle. */
type Phase = "idle" | "previewing" | "previewed" | "applying" | "done" | "error";

type ConflictStrategy = "OVERWRITE" | "SKIP";

const badgeTone: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-gray-100 text-gray-700",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
};

export function CatalogImportPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const importMutation = usePlatformCatalogItemsControllerImport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("OVERWRITE");
  const [result, setResult] = useState<ImportCatalogItemsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busy = phase === "previewing" || phase === "applying" || importMutation.isPending;

  /** Any change to the file or strategy invalidates a prior preview. */
  function resetPreview() {
    setResult(null);
    setErrorMessage(null);
    if (phase !== "idle") setPhase("idle");
  }

  function handleDownloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog-items-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    // Read raw text only — the backend owns CSV parsing.
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    resetPreview();
  }

  function handleStrategyChange(next: ConflictStrategy) {
    if (next === conflictStrategy) return;
    setConflictStrategy(next);
    resetPreview();
  }

  async function handlePreview() {
    if (!csvText || busy) return;
    setPhase("previewing");
    setErrorMessage(null);
    try {
      const res = await importMutation.mutateAsync({
        data: { mode: "DRY_RUN", conflictStrategy, csv: csvText },
      });
      setResult(res);
      setPhase("previewed");
    } catch (err) {
      setErrorMessage(getErrorMessage(err, STRINGS.previewFailed));
      setPhase("error");
    }
  }

  const canApply =
    phase === "previewed" && !!result && result.summary.errors === 0 && !busy;

  async function handleApply() {
    if (!csvText || !canApply) return;
    setPhase("applying");
    setErrorMessage(null);
    try {
      const res = await importMutation.mutateAsync({
        data: { mode: "APPLY", conflictStrategy, csv: csvText },
      });
      if (res.applied) {
        toast.success(STRINGS.applySuccess, STRINGS.applySuccessDetail(res.summary));
        void queryClient.invalidateQueries({
          queryKey: getPlatformCatalogItemsControllerListQueryKey(),
        });
        handleClose();
        return;
      }
      // Backend refused (rows still have errors): re-render and keep open.
      setResult(res);
      setPhase("previewed");
      toast.error(STRINGS.applyFailed, STRINGS.applyRefused);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, STRINGS.applyFailed));
      setPhase("error");
    }
  }

  function handleClose() {
    if (busy) return;
    setPhase("idle");
    setCsvText(null);
    setFileName(null);
    setConflictStrategy("OVERWRITE");
    setResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  const summary = result?.summary;
  const hasErrors = (summary?.errors ?? 0) > 0;

  return (
    <Modal open={open} onClose={handleClose} title={STRINGS.importTitle} widthClass="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{STRINGS.importIntro}</p>

        {/* Template + file */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
            {STRINGS.downloadTemplate}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {STRINGS.chooseFile}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <span className="text-xs text-gray-500">
            {fileName ? STRINGS.fileLoaded(fileName) : STRINGS.noFileChosen}
          </span>
        </div>

        {/* Conflict strategy */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">{STRINGS.conflictLegend}</legend>
          <div className="flex gap-4">
            {(
              [
                ["OVERWRITE", STRINGS.conflictOverwrite],
                ["SKIP", STRINGS.conflictSkip],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="conflictStrategy"
                  value={value}
                  checked={conflictStrategy === value}
                  onChange={() => handleStrategyChange(value)}
                  disabled={busy}
                  className="text-brand-600 focus:ring-brand-500"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
          <Button onClick={handlePreview} loading={phase === "previewing"} disabled={!csvText || busy}>
            {phase === "previewing" ? STRINGS.previewing : STRINGS.preview}
          </Button>
          <Button variant="secondary" onClick={handleApply} loading={phase === "applying"} disabled={!canApply}>
            {phase === "applying" ? STRINGS.applying : STRINGS.apply}
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            {STRINGS.close}
          </Button>
        </div>

        {/* Request-level error (network / 4xx / 5xx) */}
        {phase === "error" && errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        {/* Preview result */}
        {summary ? (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <SummaryStat label={STRINGS.sumTotal} value={summary.total} />
              <SummaryStat label={STRINGS.sumCreate} value={summary.toCreate} tone="green" />
              <SummaryStat label={STRINGS.sumUpdate} value={summary.toUpdate} tone="blue" />
              <SummaryStat label={STRINGS.sumUnchanged} value={summary.unchanged} />
              <SummaryStat label={STRINGS.sumSkipped} value={summary.skipped} tone="yellow" />
              <SummaryStat
                label={STRINGS.sumErrors}
                value={summary.errors}
                tone={hasErrors ? "red" : "gray"}
              />
            </div>

            {hasErrors ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {STRINGS.errorsHelp}
              </div>
            ) : null}

            {/* Row table */}
            <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <tr>
                    <th className="w-14 px-3 py-2">{STRINGS.rowLine}</th>
                    <th className="px-3 py-2">{STRINGS.rowSlug}</th>
                    <th className="w-28 px-3 py-2">{STRINGS.rowAction}</th>
                    <th className="px-3 py-2">{STRINGS.rowMessages}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result && result.rows.length > 0 ? (
                    result.rows.map((row, i) => (
                      <tr key={`${row.line}-${i}`} className="align-top">
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{row.line}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{row.slug}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                              badgeTone[actionTone(row.action)]
                            }
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {row.messages.length > 0 ? (
                            <ul className="space-y-0.5">
                              {row.messages.map((m, j) => (
                                <li key={j} className="text-xs text-gray-600">
                                  <span className="font-mono font-medium text-gray-800">{m.code}</span>
                                  {m.field ? (
                                    <span className="text-gray-400"> · {m.field}</span>
                                  ) : null}
                                  <span className="text-gray-500"> — {m.detail}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                        {STRINGS.noRows}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function SummaryStat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "green" | "blue" | "yellow" | "red" | "gray";
}) {
  const toneText: Record<string, string> = {
    green: "text-green-700",
    blue: "text-blue-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
    gray: "text-gray-800",
  };
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-center">
      <div className={"text-lg font-semibold " + toneText[tone]}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
