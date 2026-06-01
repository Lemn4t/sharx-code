"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { postJson } from "@/lib/api";
import { panel } from "@/lib/paths";
import type { StreamFormState } from "@/lib/inboundDefaults";
import { Button, Spinner, Textarea, useToast } from "@/components/ui";

type Props = {
  streamForm: StreamFormState;
  setStreamFormField: <K extends keyof StreamFormState>(
    key: K,
    value: StreamFormState[K],
  ) => void;
  idPrefix: string;
  disabled?: boolean;
  /** Show self-signed certificate generator (TLS / Hysteria server certs). */
  showSelfSigned?: boolean;
};

export function InboundTlsCertPinBlock({
  streamForm,
  setStreamFormField,
  idPrefix,
  disabled = false,
  showSelfSigned = true,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [generatingSelfSigned, setGeneratingSelfSigned] = useState(false);
  const [computingPin, setComputingPin] = useState(false);

  const generateSelfSignedTls = useCallback(async () => {
    setGeneratingSelfSigned(true);
    try {
      const sni = streamForm.tlsServerName.trim();
      const dnsNames =
        sni !== "" ? Array.from(new Set([sni, "localhost"])) : ["localhost"];
      const r = await postJson<{
        certPem: string;
        keyPem: string;
        pinnedPeerCertSha256?: string;
      }>(
        panel("api/inbounds/generateSelfSignedTls"),
        {
          commonName: sni || "localhost",
          dnsNames,
          ipAddresses: ["127.0.0.1"],
          validityDays: 365,
        },
        true,
      );
      if (r.success && r.obj != null) {
        const o = r.obj;
        setStreamFormField("tlsCertificatePem", o.certPem);
        setStreamFormField("tlsKeyPem", o.keyPem);
        setStreamFormField("tlsCertificateFile", "");
        setStreamFormField("tlsKeyFile", "");
        if (o.pinnedPeerCertSha256) {
          setStreamFormField("tlsPinnedSha256", o.pinnedPeerCertSha256);
        }
        setStreamFormField("tlsAllowInsecure", false);
        toast.success(
          (r as { msg?: string }).msg ||
            t("pages.inbounds.toasts.generateSelfSignedSuccess", {
              defaultValue: "Self-signed certificate generated.",
            }),
        );
      } else {
        toast.error(
          (r as { msg?: string }).msg || t("fail", { defaultValue: "Error" }),
        );
      }
    } catch {
      toast.error(t("fail", { defaultValue: "Error" }));
    } finally {
      setGeneratingSelfSigned(false);
    }
  }, [setStreamFormField, streamForm.tlsServerName, t, toast]);

  const computeTlsPin = useCallback(async () => {
    const certPem = streamForm.tlsCertificatePem.trim();
    const certificateFile = streamForm.tlsCertificateFile.trim();
    if (!certPem && !certificateFile) {
      toast.error(
        t("pages.inbounds.toasts.tlsPinNeedSource", {
          defaultValue: "Paste a PEM certificate or set a certificate file path first.",
        }),
      );
      return;
    }
    setComputingPin(true);
    try {
      const r = await postJson<{ pinnedPeerCertSha256: string }>(
        panel("api/inbounds/computeTlsPin"),
        { certPem, certificateFile },
        true,
      );
      if (r.success && r.obj?.pinnedPeerCertSha256) {
        setStreamFormField("tlsPinnedSha256", r.obj.pinnedPeerCertSha256);
        setStreamFormField("tlsAllowInsecure", false);
        toast.success(
          (r as { msg?: string }).msg ||
            t("pages.inbounds.toasts.tlsPinSuccess", {
              defaultValue: "Certificate SHA-256 pin computed.",
            }),
        );
      } else {
        toast.error(
          (r as { msg?: string }).msg ||
            t("pages.inbounds.toasts.tlsPinFailed", {
              defaultValue: "Could not compute certificate pin.",
            }),
        );
      }
    } catch {
      toast.error(
        t("pages.inbounds.toasts.tlsPinFailed", {
          defaultValue: "Could not compute certificate pin.",
        }),
      );
    } finally {
      setComputingPin(false);
    }
  }, [
    setStreamFormField,
    streamForm.tlsCertificateFile,
    streamForm.tlsCertificatePem,
    t,
    toast,
  ]);

  const busy = disabled || generatingSelfSigned || computingPin;

  return (
    <div className="space-y-3">
      {showSelfSigned ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--fg-subtle)]">
            {t("pages.inbounds.generateSelfSignedTlsHint", {
              defaultValue:
                "Self-signed: uses Server name (SNI) as CN/SAN, fills PEM fields, and sets pinnedPeerCertSha256 for JSON subscriptions (replaces deprecated allowInsecure).",
            })}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 text-xs"
            disabled={busy}
            onClick={() => {
              void generateSelfSignedTls();
            }}
          >
            {generatingSelfSigned ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-3.5 w-3.5" />
                {t("loading")}
              </span>
            ) : (
              t("pages.inbounds.generateSelfSignedTls", {
                defaultValue: "Generate self-signed (PEM)",
              })
            )}
          </Button>
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label
            className="text-xs font-medium text-[var(--fg-muted)]"
            htmlFor={`${idPrefix}-pinned`}
          >
            {t("pages.inbounds.tlsPinnedSha256", {
              defaultValue: "pinnedPeerCertSha256",
            })}
          </label>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            disabled={busy}
            onClick={() => {
              void computeTlsPin();
            }}
          >
            {computingPin ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-3.5 w-3.5" />
                {t("loading")}
              </span>
            ) : (
              t("pages.inbounds.computeTlsPin", {
                defaultValue: "Compute from certificate",
              })
            )}
          </Button>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-[var(--fg-subtle)]">
          {t("pages.inbounds.tlsPinnedSha256Hint", {
            defaultValue:
              "Required in JSON subscriptions for self-signed or non-public CA certificates. One or more SHA-256 pins (hex), comma or newline separated.",
          })}
        </p>
        <Textarea
          id={`${idPrefix}-pinned`}
          className="min-h-[60px] font-mono text-xs"
          value={streamForm.tlsPinnedSha256}
          disabled={disabled}
          onChange={(e) => setStreamFormField("tlsPinnedSha256", e.target.value)}
          placeholder="e8e2d387fdbffeb38e9c9065cf30a97ee23c0e3d32ee6f78ffae40966befccc9"
        />
      </div>
    </div>
  );
}
