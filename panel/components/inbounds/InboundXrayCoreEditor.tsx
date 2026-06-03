"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { InboundFormProtocol } from "@/lib/inboundDefaults";
import { inboundCoreConfigMonacoSchemas } from "@/lib/inboundJsonMonacoSchemas";
import {
  roundTripInboundCoreConfig,
  type InboundCoreConfigApplyPatch,
} from "@/lib/inboundJsonSanitize";
import { AlertBanner, Button, MonacoJsonEditor, Spinner } from "@/components/ui";

export type InboundCoreConfigApplyPayload = {
  listen: string;
  port: number;
  tag: string;
  streamFormJson: string;
  sniffingFormJson: string;
  settingsStr: string;
  formPatch: InboundCoreConfigApplyPatch["formPatch"];
  strippedKeys: string[];
};

type InboundXrayCoreEditorProps = {
  protocol: InboundFormProtocol;
  baselineSettings: string;
  value: string;
  loading: boolean;
  error: string | null;
  onChange: (text: string) => void;
  onApplyToForm: (payload: InboundCoreConfigApplyPayload) => void;
  onReloadFromServer?: () => void;
};

export function InboundXrayCoreEditor({
  protocol,
  baselineSettings,
  value,
  loading,
  error,
  onChange,
  onApplyToForm,
  onReloadFromServer,
}: InboundXrayCoreEditorProps) {
  const { t } = useTranslation();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [strippedHint, setStrippedHint] = useState<string | null>(null);

  const schemaBundle = inboundCoreConfigMonacoSchemas(t, protocol);

  const validateAndApply = useCallback(() => {
    const rt = roundTripInboundCoreConfig(value, protocol, baselineSettings);
    if (!rt.ok) {
      setValidationError(rt.message);
      setStrippedHint(null);
      return;
    }
    setValidationError(null);
    const { strippedKeys } = rt.patch;
    if (strippedKeys.length > 0) {
      setStrippedHint(
        t("pages.inbounds.jsonStrippedKeys", {
          defaultValue: "Removed unsupported keys: {{keys}}",
          keys: strippedKeys.slice(0, 12).join(", ") + (strippedKeys.length > 12 ? "…" : ""),
        }),
      );
    } else {
      setStrippedHint(null);
    }
    onApplyToForm({
      listen: rt.patch.listen,
      port: rt.patch.port,
      tag: rt.patch.tag,
      streamFormJson: rt.patch.streamSettingsStr,
      sniffingFormJson: rt.patch.sniffingStr,
      settingsStr: rt.patch.settingsStr,
      formPatch: rt.patch.formPatch,
      strippedKeys,
    });
  }, [baselineSettings, onApplyToForm, protocol, t, value]);

  return (
    <div className="space-y-3">
      <AlertBanner
        type="info"
        title={t("pages.inbounds.xrayCoreEditorHint", {
          defaultValue:
            "Edit the inbound as merged into the Xray core config (listen, port, tag, settings, streamSettings, sniffing). You may change clients[] in settings; unsupported keys are removed on Apply or Save. Node bindings are not edited here.",
        })}
      />

      {error ? <AlertBanner type="warning" title={error} /> : null}
      {validationError ? <AlertBanner type="warning" title={validationError} /> : null}
      {strippedHint ? <p className="text-xs text-[var(--fg-muted)]">{strippedHint}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]">
        {loading && !value.trim() ? (
          <div className="grid min-h-32 place-items-center p-6">
            <Spinner size={28} />
          </div>
        ) : (
          <MonacoJsonEditor
            path="inbound-xray-core.json"
            value={value}
            onChange={(v) => {
              setValidationError(null);
              onChange(v);
            }}
            height="min(60dvh, 28rem)"
            schemaBundle={schemaBundle}
          />
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onReloadFromServer ? (
          <Button type="button" variant="ghost" onClick={onReloadFromServer}>
            {t("pages.inbounds.xrayCoreReloadPreview", {
              defaultValue: "Reload from form",
            })}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={loading || !value.trim()}
          onClick={validateAndApply}
        >
          {t("pages.inbounds.jsonApplyToForm", { defaultValue: "Apply to form" })}
        </Button>
      </div>
    </div>
  );
}
