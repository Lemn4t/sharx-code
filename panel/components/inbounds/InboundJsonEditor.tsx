"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildSniffingFromForm,
  buildStreamSettingsFromForm,
  type InboundFormProtocol,
} from "@/lib/inboundDefaults";
import {
  extractInboundServerSettingsJson,
  inboundSettingsJsonEditorSupported,
  mergeInboundServerSettingsJson,
  roundTripInboundSniffing,
  roundTripInboundStreamSettings,
  serverSettingsJsonToFormPatch,
} from "@/lib/inboundJsonSanitize";
import { inboundJsonMonacoPath, inboundJsonMonacoSchemas } from "@/lib/inboundJsonMonacoSchemas";
import { AlertBanner, Button, MonacoJsonEditor, Tabs } from "@/components/ui";

export type InboundJsonDraft = {
  stream: string;
  sniffing: string;
  settings: string;
};

type InboundJsonEditorProps = {
  protocol: InboundFormProtocol;
  baselineSettings: string;
  streamJson: string;
  sniffingJson: string;
  settingsJson: string;
  onChange: (draft: InboundJsonDraft) => void;
  onApplyToForm: (patch: {
    streamFormJson: string;
    sniffingFormJson: string;
    settingsServerPatch: ReturnType<typeof serverSettingsJsonToFormPatch>;
    strippedKeys: string[];
  }) => void;
};

type JsonDocId = "stream" | "sniffing" | "settings";

export function InboundJsonEditor({
  protocol,
  baselineSettings,
  streamJson,
  sniffingJson,
  settingsJson,
  onChange,
  onApplyToForm,
}: InboundJsonEditorProps) {
  const { t } = useTranslation();
  const showSettings = inboundSettingsJsonEditorSupported(protocol);
  const showStream = protocol !== "wireguard" && protocol !== "telemt";

  const tabItems = useMemo(() => {
    const tabs: { id: JsonDocId; label: string }[] = [];
    if (showStream) {
      tabs.push({
        id: "stream",
        label: t("pages.inbounds.jsonTabStream", { defaultValue: "streamSettings" }),
      });
    }
    tabs.push({
      id: "sniffing",
      label: t("pages.inbounds.jsonTabSniffing", { defaultValue: "sniffing" }),
    });
    if (showSettings) {
      tabs.push({
        id: "settings",
        label: t("pages.inbounds.jsonTabSettings", { defaultValue: "settings (server)" }),
      });
    }
    return tabs;
  }, [showSettings, showStream, t]);

  const [activeDoc, setActiveDoc] = useState<JsonDocId>(showStream ? "stream" : "sniffing");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [strippedHint, setStrippedHint] = useState<string | null>(null);

  useEffect(() => {
    if (!tabItems.some((tab) => tab.id === activeDoc)) {
      setActiveDoc(tabItems[0]?.id ?? "sniffing");
    }
  }, [activeDoc, tabItems]);

  const schemaBundle = useMemo(
    () => inboundJsonMonacoSchemas(t, protocol, activeDoc),
    [activeDoc, protocol, t],
  );

  const validateAndApply = useCallback(() => {
    const stripped: string[] = [];
    let streamOut = streamJson;
    let sniffingOut = sniffingJson;

    if (showStream) {
      const rt = roundTripInboundStreamSettings(streamJson, protocol);
      if (!rt.ok) {
        setValidationError(rt.message);
        setStrippedHint(null);
        return;
      }
      streamOut = rt.json;
      stripped.push(...rt.strippedKeys);
    }

    const sn = roundTripInboundSniffing(sniffingJson);
    if (!sn.ok) {
      setValidationError(sn.message);
      setStrippedHint(null);
      return;
    }
    sniffingOut = sn.json;
    stripped.push(...sn.strippedKeys);

    if (showSettings) {
      const merged = mergeInboundServerSettingsJson(baselineSettings, settingsJson, protocol);
      if (!merged.ok) {
        setValidationError(merged.message);
        setStrippedHint(null);
        return;
      }
      stripped.push(...merged.strippedKeys);
    }

    setValidationError(null);
    if (stripped.length > 0) {
      setStrippedHint(
        t("pages.inbounds.jsonStrippedKeys", {
          defaultValue: "Removed keys not supported by the form: {{keys}}",
          keys: stripped.slice(0, 12).join(", ") + (stripped.length > 12 ? "…" : ""),
        }),
      );
    } else {
      setStrippedHint(null);
    }

    onChange({ stream: streamOut, sniffing: sniffingOut, settings: settingsJson });
    onApplyToForm({
      streamFormJson: streamOut,
      sniffingFormJson: sniffingOut,
      settingsServerPatch: showSettings
        ? serverSettingsJsonToFormPatch(settingsJson, protocol)
        : {},
      strippedKeys: stripped,
    });
  }, [
    baselineSettings,
    onApplyToForm,
    onChange,
    protocol,
    settingsJson,
    showSettings,
    showStream,
    sniffingJson,
    streamJson,
    t,
  ]);

  const editorValue =
    activeDoc === "stream"
      ? streamJson
      : activeDoc === "sniffing"
        ? sniffingJson
        : settingsJson;

  const setEditorValue = (v: string) => {
    if (activeDoc === "stream") {
      onChange({ stream: v, sniffing: sniffingJson, settings: settingsJson });
    } else if (activeDoc === "sniffing") {
      onChange({ stream: streamJson, sniffing: v, settings: settingsJson });
    } else {
      onChange({ stream: streamJson, sniffing: sniffingJson, settings: v });
    }
  };

  return (
    <div className="space-y-3">
      <AlertBanner
        type="info"
        title={t("pages.inbounds.jsonEditorHint", {
          defaultValue:
            "Edit streamSettings, sniffing, and server-only settings. Unknown fields are removed on Apply or Save. Clients and node bindings are not edited here.",
        })}
      />

      {validationError ? (
        <AlertBanner type="warning" title={validationError} />
      ) : null}
      {strippedHint ? <p className="text-xs text-[var(--fg-muted)]">{strippedHint}</p> : null}

      <Tabs
        tabs={tabItems}
        active={activeDoc}
        onChange={(id) => setActiveDoc(id as JsonDocId)}
        variant="pill"
        size="sm"
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        <MonacoJsonEditor
          path={inboundJsonMonacoPath(activeDoc)}
          value={editorValue}
          onChange={setEditorValue}
          height="min(50dvh, 22rem)"
          schemaBundle={schemaBundle}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={validateAndApply}>
          {t("pages.inbounds.jsonApplyToForm", { defaultValue: "Apply to form" })}
        </Button>
      </div>
    </div>
  );
}

/** Build initial JSON drafts from the structured inbound form state. */
export function buildInboundJsonDraftFromForm(args: {
  protocol: InboundFormProtocol;
  streamForm: Parameters<typeof buildStreamSettingsFromForm>[0];
  sniffingForm: Parameters<typeof buildSniffingFromForm>[0];
  baselineSettings: string;
}): InboundJsonDraft {
  const stream =
    args.protocol === "wireguard" || args.protocol === "telemt"
      ? "{}"
      : buildStreamSettingsFromForm(args.streamForm, args.protocol);
  const sniffing = buildSniffingFromForm(args.sniffingForm);
  const settings = inboundSettingsJsonEditorSupported(args.protocol)
    ? extractInboundServerSettingsJson(args.baselineSettings, args.protocol)
    : "{}";
  try {
    return {
      stream: JSON.stringify(JSON.parse(stream), null, 2),
      sniffing: JSON.stringify(JSON.parse(sniffing), null, 2),
      settings,
    };
  } catch {
    return { stream, sniffing, settings };
  }
}
