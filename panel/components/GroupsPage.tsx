"use client";

import { ArrowDown, ArrowUp, Building2, Pencil, Plus, Trash2 } from "lucide-react";
import type { TextareaHTMLAttributes } from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getJson, postJson, type Msg } from "@/lib/api";
import { panel } from "@/lib/paths";
import { PageScaffold, PageHeader, Surface } from "@/components/panel";
import {
  Button,
  CheckboxField,
  ConfirmDialog,
  IconTile,
  Input,
  Modal,
  Reveal,
  Spinner,
  useToast,
} from "@/components/ui";

/** Capsule toggle for inbound chips in group bulk-edit, matching the client-edit modal. */
function GroupInboundCapsule({
  selected,
  onToggle,
  label,
  sublabel,
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        "inline-flex min-w-0 max-w-full flex-col rounded-full border px-3 py-1.5 text-left text-xs transition-colors " +
        (selected
          ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--fg)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--fg-subtle)]")
      }
    >
      <span className="truncate font-medium">{label}</span>
      <span className="truncate text-[10px] text-[var(--fg-subtle)]">{sublabel}</span>
    </button>
  );
}

type GroupRow = {
  id: number;
  name: string;
  description: string;
  clientCount: number;
};

type InboundOption = {
  id: number;
  remark: string;
  protocol: string;
  port: number;
};

type PendingBulk = {
  action: "reset" | "clearHwid" | "deleteAll" | "enable" | "disable";
  group: GroupRow;
};

function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-[88px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] ${className}`}
      {...rest}
    />
  );
}

function pendingBulkDescription(
  t: (k: string) => string,
  p: PendingBulk,
): string {
  switch (p.action) {
    case "reset":
      return t("pages.groups.bulkResetTrafficConfirm");
    case "clearHwid":
      return t("pages.groups.bulkClearHwidConfirm");
    case "deleteAll":
      return t("pages.groups.bulkDeleteConfirm");
    case "enable":
      return t("pages.groups.bulkEnableConfirm");
    case "disable":
      return t("pages.groups.bulkDisableConfirm");
    default:
      return "";
  }
}

export function GroupsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [bulkGroup, setBulkGroup] = useState<GroupRow | null>(null);
  const [pendingBulk, setPendingBulk] = useState<PendingBulk | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);

  // Inline sections inside the unified edit modal. Each "section" tracks only
  // its own submit-busy flag; opening/closing follows bulkGroup.
  const [hwidForm, setHwidForm] = useState({ maxHwid: 0, enabled: true });
  const [hwidSubmitting, setHwidSubmitting] = useState(false);

  const [inbounds, setInbounds] = useState<InboundOption[]>([]);
  const [inboundIds, setInboundIds] = useState<Record<number, boolean>>({});
  // Ordered subset of inboundIds (true ones), preserving the order shown in subscriptions.
  const [inboundOrder, setInboundOrder] = useState<number[]>([]);
  const [inboundSubmitting, setInboundSubmitting] = useState(false);

  const [expiryValue, setExpiryValue] = useState<string>("");
  const [expirySubmitting, setExpirySubmitting] = useState(false);

  const [trafficGB, setTrafficGB] = useState<number>(0);
  const [trafficSubmitting, setTrafficSubmitting] = useState(false);

  const [ipForm, setIpForm] = useState({ maxIPs: 1, enabled: true });
  const [ipSubmitting, setIpSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await getJson<GroupRow[]>(panel("group/list"));
    setLoading(false);
    if (r.success && Array.isArray(r.obj)) {
      setRows(
        (r.obj as GroupRow[]).map((x) => ({
          id: x.id,
          name: x.name ?? "",
          description: x.description ?? "",
          clientCount: x.clientCount ?? 0,
        })),
      );
    } else {
      setRows([]);
    }
  }, []);

  const loadInbounds = useCallback(async () => {
    const r = await getJson<InboundOption[]>(panel("api/inbounds/list"));
    if (r.success && Array.isArray(r.obj)) {
      setInbounds(
        (r.obj as InboundOption[]).map((x) => ({
          id: x.id,
          remark: x.remark || t("pages.groups.inboundFallback", { id: x.id }),
          protocol: x.protocol,
          port: x.port,
        })),
      );
    } else {
      setInbounds([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (bulkGroup) void loadInbounds();
  }, [bulkGroup, loadInbounds]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", description: "" });
    setFormOpen(true);
  };

  const openEdit = (r: GroupRow) => {
    setEditingId(r.id);
    setForm({ name: r.name, description: r.description });
    setHwidForm({ maxHwid: 0, enabled: true });
    setIpForm({ maxIPs: 1, enabled: true });
    setTrafficGB(0);
    setExpiryValue("");
    setInboundIds({});
    setInboundOrder([]);
    setBulkGroup(r);
  };

  const toggleInboundId = (id: number) => {
    setInboundIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const isOn = next[id];
      setInboundOrder((order) => {
        if (isOn) return order.includes(id) ? order : [...order, id];
        return order.filter((x) => x !== id);
      });
      return next;
    });
  };

  const moveInboundOrder = (idx: number, dir: -1 | 1) => {
    setInboundOrder((order) => {
      const j = idx + dir;
      if (j < 0 || j >= order.length) return order;
      const next = order.slice();
      const a = next[idx]!;
      const b = next[j]!;
      next[idx] = b;
      next[j] = a;
      return next;
    });
  };

  const submitForm = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(t("pages.groups.enterGroupName"));
      return;
    }
    setFormSubmitting(true);
    try {
      const body = { name, description: form.description.trim() };
      const r =
        editingId == null
          ? await postJson<unknown>(panel("group/add"), body, true)
          : await postJson<unknown>(
              panel(`group/update/${editingId}`),
              body,
              true,
            );
      if (r.success) {
        toast.success(
          (r as { msg?: string }).msg ||
            t(
              editingId == null
                ? "pages.groups.addSuccess"
                : "pages.groups.updateSuccess",
            ),
        );
        if (editingId == null) {
          setFormOpen(false);
        } else if (bulkGroup) {
          // Sync the in-place row + title with the new name/description without closing the edit modal.
          const updated: GroupRow = {
            ...bulkGroup,
            name: name,
            description: form.description.trim(),
          };
          setBulkGroup(updated);
        }
        void load();
      } else {
        toast.error(
          (r as { msg?: string }).msg ||
            t(
              editingId == null
                ? "pages.groups.addError"
                : "pages.groups.updateError",
            ),
        );
      }
    } catch {
      toast.error(
        t(
          editingId == null
            ? "pages.groups.addError"
            : "pages.groups.updateError",
        ),
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId == null) return;
    setDeleting(true);
    const r = await postJson(panel(`group/del/${deleteId}`));
    setDeleting(false);
    if (r.success) {
      toast.success(
        (r as { msg?: string }).msg || t("pages.groups.deleteSuccess"),
      );
      setDeleteId(null);
      void load();
    } else {
      toast.error(
        (r as { msg?: string }).msg || t("pages.groups.deleteError"),
      );
    }
  };

  const startBulkConfirm = (action: PendingBulk["action"], group: GroupRow) => {
    setBulkGroup(null);
    setPendingBulk({ action, group });
  };

  const runPendingBulk = async () => {
    if (pendingBulk == null) return;
    const { action, group } = pendingBulk;
    const id = group.id;
    setBulkWorking(true);
    let r: Msg<unknown> | null = null;
    try {
      switch (action) {
        case "reset":
          r = await postJson<unknown>(panel(`group/${id}/bulk/resetTraffic`), {}, true);
          break;
        case "clearHwid":
          r = await postJson<unknown>(panel(`group/${id}/bulk/clearHwid`), {}, true);
          break;
        case "deleteAll":
          r = await postJson<unknown>(panel(`group/${id}/bulk/delete`), {}, true);
          break;
        case "enable":
          r = await postJson<unknown>(
            panel(`group/${id}/bulk/enable`),
            { enable: true },
            true,
          );
          break;
        case "disable":
          r = await postJson<unknown>(
            panel(`group/${id}/bulk/enable`),
            { enable: false },
            true,
          );
          break;
        default:
          break;
      }
    } catch {
      r = null;
    } finally {
      setBulkWorking(false);
    }
    if (r?.success) {
      toast.success(
        (r as { msg?: string }).msg || t("success", { defaultValue: "OK" }),
      );
      setPendingBulk(null);
      void load();
    } else {
      toast.error(
        (r as { msg?: string } | null)?.msg ||
          t("fail", { defaultValue: "Error" }),
      );
    }
  };

  const submitHwid = async () => {
    if (bulkGroup == null) return;
    setHwidSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${bulkGroup.id}/bulk/setHwidLimit`),
        {
          maxHwid: Math.max(0, Math.floor(Number(hwidForm.maxHwid)) || 0),
          enabled: hwidForm.enabled,
        },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        void load();
      } else {
        toast.error((r as { msg?: string }).msg || t("fail", { defaultValue: "Error" }));
      }
    } catch {
      toast.error(t("fail", { defaultValue: "Error" }));
    } finally {
      setHwidSubmitting(false);
    }
  };

  const submitExpiry = async () => {
    if (bulkGroup == null) return;
    const ts = expiryValue ? new Date(expiryValue).getTime() : 0;
    if (expiryValue && isNaN(ts)) {
      toast.error(t("pages.groups.invalidDate", { defaultValue: "Invalid date" }));
      return;
    }
    setExpirySubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${bulkGroup.id}/bulk/setExpiry`),
        { expiryTime: ts },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        void load();
      } else {
        toast.error((r as { msg?: string }).msg || t("fail", { defaultValue: "Error" }));
      }
    } catch {
      toast.error(t("fail", { defaultValue: "Error" }));
    } finally {
      setExpirySubmitting(false);
    }
  };

  const submitTraffic = async () => {
    if (bulkGroup == null) return;
    setTrafficSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${bulkGroup.id}/bulk/setTrafficLimit`),
        { totalGB: Math.max(0, trafficGB) },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        void load();
      } else {
        toast.error((r as { msg?: string }).msg || t("fail", { defaultValue: "Error" }));
      }
    } catch {
      toast.error(t("fail", { defaultValue: "Error" }));
    } finally {
      setTrafficSubmitting(false);
    }
  };

  const submitIP = async () => {
    if (bulkGroup == null) return;
    setIpSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${bulkGroup.id}/bulk/setIPLimit`),
        { maxIPs: Math.max(0, ipForm.maxIPs), enabled: ipForm.enabled },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        void load();
      } else {
        toast.error((r as { msg?: string }).msg || t("fail", { defaultValue: "Error" }));
      }
    } catch {
      toast.error(t("fail", { defaultValue: "Error" }));
    } finally {
      setIpSubmitting(false);
    }
  };

  const submitInbounds = async () => {
    if (bulkGroup == null) return;
    // Use the ordered list (subscription order) — backend persists slice order as sort_order.
    const ordered = inboundOrder.filter((id) => inboundIds[id]);
    setInboundSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${bulkGroup.id}/bulk/assignInbounds`),
        { inboundIds: ordered, mode: "replace" },
        true,
      );
      if (r.success) {
        toast.success(
          (r as { msg?: string }).msg || t("pages.groups.inboundsAssigned"),
        );
        void load();
      } else {
        toast.error(
          (r as { msg?: string }).msg ||
            t("fail", { defaultValue: "Error" }),
        );
      }
    } catch {
      toast.error(t("fail", { defaultValue: "Error" }));
    } finally {
      setInboundSubmitting(false);
    }
  };

  const isEdit = editingId != null;

  return (
    <PageScaffold compact>
      <PageHeader
        title={t("menu.groups")}
        icon={Building2}
        iconTone="warning"
        actions={
          <>
            <Button variant="secondary" onClick={openAdd} className="!gap-2">
              <Plus size={16} />
              {t("pages.groups.addGroup")}
            </Button>
          </>
        }
      />
      <Reveal>
      <Surface padding="none" className="overflow-hidden">
        {loading && !rows.length ? (
          <div className="grid min-h-48 place-items-center">
            <Spinner size={32} />
          </div>
        ) : !rows.length ? (
          <div className="grid min-h-48 place-items-center px-4 py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <IconTile icon={Building2} tone="neutral" size="lg" />
              <p className="text-sm text-[var(--fg-muted)]">{t("noData")}</p>
            </div>
          </div>
        ) : (
          <div className="panel-data-table overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
                  <th className="p-3">{t("pages.groups.name")}</th>
                  <th className="p-3">{t("pages.groups.groupDescription")}</th>
                  <th className="p-3">{t("pages.groups.clientCount")}</th>
                  <th className="p-3 w-44">{t("pages.groups.operate")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)] text-[var(--fg-muted)] hover:bg-[color-mix(in_oklab,var(--accent)_5%,transparent)]"
                  >
                    <td className="p-3 text-[var(--fg)]">{r.name}</td>
                    <td
                      className="p-3 max-w-[240px] truncate"
                      title={r.description}
                    >
                      {r.description || "—"}
                    </td>
                      <td className="p-3 font-mono text-xs">{t("pages.groups.clientDisplay", { count: r.clientCount })}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="secondary"
                          className="!p-2"
                          onClick={() => openEdit(r)}
                          aria-label={t("pages.groups.editGroup")}
                          title={t("pages.groups.editGroup")}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="danger"
                          className="!p-2"
                          onClick={() => setDeleteId(r.id)}
                          aria-label={t("delete")}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
      </Reveal>

      <Modal
        open={bulkGroup != null}
        onClose={() => {
          setBulkGroup(null);
          setEditingId(null);
        }}
        title={
          bulkGroup
            ? `${t("pages.groups.editGroup")} — ${bulkGroup.name}`
            : t("pages.groups.editGroup")
        }
        width={560}
        footer={
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setBulkGroup(null);
              setEditingId(null);
            }}
          >
            {t("close")}
          </Button>
        }
      >
        {bulkGroup ? (
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {t("pages.groups.clientDisplay", { count: bulkGroup.clientCount })}
            </p>

            {/* General — group metadata */}
            {editingId === bulkGroup.id ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                  {t("pages.groups.sectionGeneral", { defaultValue: "General" })}
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--fg-muted)]" htmlFor="grp-edit-name">
                      {t("pages.groups.groupName")}
                    </label>
                    <Input
                      id="grp-edit-name"
                      value={form.name}
                      maxLength={30}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--fg-muted)]" htmlFor="grp-edit-desc">
                      {t("pages.groups.groupDescription")}
                    </label>
                    <TextArea
                      id="grp-edit-desc"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      type="button"
                      loading={formSubmitting}
                      onClick={() => void submitForm()}
                    >
                      {t("save", { defaultValue: "Save" })}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Limits — inline forms with per-row Apply button */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                {t("pages.groups.sectionLimits", { defaultValue: "Limits" })}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Expiry */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-[var(--fg-muted)]" htmlFor="grp-expiry">
                    {t("pages.groups.bulkSetExpiry", { defaultValue: "Set expiry date" })}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="grp-expiry"
                      type="datetime-local"
                      value={expiryValue}
                      onChange={(e) => setExpiryValue(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      loading={expirySubmitting}
                      disabled={bulkGroup.clientCount < 1}
                      onClick={() => void submitExpiry()}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                  <p className="text-[11px] text-[var(--fg-subtle)]">
                    {t("pages.groups.expiryDate", { defaultValue: "Leave blank for unlimited" })}
                  </p>
                </div>

                {/* Traffic limit */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-[var(--fg-muted)]" htmlFor="grp-traffic">
                    {t("pages.groups.bulkSetTrafficLimit", { defaultValue: "Set traffic limit" })}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="grp-traffic"
                      type="number"
                      min={0}
                      step={0.1}
                      value={String(trafficGB)}
                      onChange={(e) => setTrafficGB(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      loading={trafficSubmitting}
                      disabled={bulkGroup.clientCount < 1}
                      onClick={() => void submitTraffic()}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                  <p className="text-[11px] text-[var(--fg-subtle)]">
                    {t("pages.groups.trafficLimitGB", { defaultValue: "GB (0 = unlimited)" })}
                  </p>
                </div>

                {/* HWID limit */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-[var(--fg-muted)]" htmlFor="grp-hwid">
                    {t("pages.groups.bulkSetHwidLimit")}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="grp-hwid"
                      type="number"
                      min={0}
                      value={String(hwidForm.maxHwid)}
                      onChange={(e) =>
                        setHwidForm((f) => ({ ...f, maxHwid: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      loading={hwidSubmitting}
                      disabled={bulkGroup.clientCount < 1}
                      onClick={() => void submitHwid()}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                  <CheckboxField
                    checked={hwidForm.enabled}
                    onChange={(e) => setHwidForm((f) => ({ ...f, enabled: e.target.checked }))}
                    label={t("pages.groups.hwidLimitEnabled")}
                  />
                </div>

                {/* IP limit */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-[var(--fg-muted)]" htmlFor="grp-ip">
                    {t("pages.groups.bulkSetIPLimit", { defaultValue: "Set IP limit" })}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="grp-ip"
                      type="number"
                      min={0}
                      value={String(ipForm.maxIPs)}
                      onChange={(e) =>
                        setIpForm((f) => ({ ...f, maxIPs: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      loading={ipSubmitting}
                      disabled={bulkGroup.clientCount < 1}
                      onClick={() => void submitIP()}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                  <CheckboxField
                    checked={ipForm.enabled}
                    onChange={(e) => setIpForm((f) => ({ ...f, enabled: e.target.checked }))}
                    label={t("pages.groups.ipLimitEnabled", { defaultValue: "Enable IP limit" })}
                  />
                </div>
              </div>
            </div>

            {/* Inbounds — capsule chips + order list, like the client modal */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                {t("pages.groups.assignInbounds")}
              </p>
              {inbounds.length === 0 ? (
                <p className="text-xs text-[var(--fg-subtle)]">{t("noData")}</p>
              ) : (
                <>
                  <div className="max-h-52 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex flex-wrap gap-2" role="group">
                      {inbounds.map((ib) => (
                        <GroupInboundCapsule
                          key={ib.id}
                          selected={!!inboundIds[ib.id]}
                          onToggle={() => toggleInboundId(ib.id)}
                          label={ib.remark}
                          sublabel={`${ib.protocol} · ${ib.port}`}
                        />
                      ))}
                    </div>
                  </div>
                  {inboundOrder.length >= 2 ? (
                    <div className="space-y-2 border-t border-[var(--border)] pt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
                        {t("pages.clients.subscriptionInboundOrder", {
                          defaultValue: "Subscription order",
                        })}
                      </p>
                      {inboundOrder.map((iid, idx) => {
                        const ib = inbounds.find((x) => x.id === iid);
                        const label = ib?.remark || `Inbound ${iid}`;
                        return (
                          <div
                            key={iid}
                            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg)]">{label}</span>
                            <Button
                              variant="secondary"
                              type="button"
                              className="!p-1.5"
                              aria-label={t("pages.clients.moveInboundUp", { defaultValue: "Move up" })}
                              disabled={idx === 0}
                              onClick={() => moveInboundOrder(idx, -1)}
                            >
                              <ArrowUp size={14} />
                            </Button>
                            <Button
                              variant="secondary"
                              type="button"
                              className="!p-1.5"
                              aria-label={t("pages.clients.moveInboundDown", { defaultValue: "Move down" })}
                              disabled={idx >= inboundOrder.length - 1}
                              onClick={() => moveInboundOrder(idx, 1)}
                            >
                              <ArrowDown size={14} />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <p className="text-[11px] text-[var(--fg-subtle)]">
                    {t("pages.groups.assignInboundsHint")}
                  </p>
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      type="button"
                      loading={inboundSubmitting}
                      disabled={bulkGroup.clientCount < 1}
                      onClick={() => void submitInbounds()}
                    >
                      {t("pages.groups.assign")}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Status */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                {t("pages.groups.sectionStatus", { defaultValue: "Status" })}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => startBulkConfirm("enable", bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkEnableAll")}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => startBulkConfirm("disable", bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkDisableAll")}
                </Button>
              </div>
            </div>

            {/* Maintenance */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                {t("pages.groups.sectionMaintenance", { defaultValue: "Maintenance" })}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => startBulkConfirm("reset", bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkResetTraffic")}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => startBulkConfirm("clearHwid", bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkClearHwid")}
                </Button>
              </div>
            </div>

            <Button
              variant="danger"
              className="w-full"
              type="button"
              onClick={() => startBulkConfirm("deleteAll", bulkGroup)}
              disabled={bulkGroup.clientCount < 1}
            >
              {t("pages.groups.deleteClients")}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!formSubmitting) setFormOpen(false);
        }}
        title={isEdit ? t("pages.groups.editGroup") : t("pages.groups.addGroup")}
        width={480}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={formSubmitting}
              onClick={() => setFormOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              type="button"
              loading={formSubmitting}
              onClick={() => void submitForm()}
            >
              {isEdit ? t("save") : t("create")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]"
              htmlFor="grp-name"
            >
              {t("pages.groups.name")} *
            </label>
            <Input
              id="grp-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value.slice(0, 30) }))
              }
              placeholder={t("pages.groups.enterGroupName")}
              maxLength={30}
              autoComplete="off"
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]"
              htmlFor="grp-desc"
            >
              {t("pages.groups.groupDescription")}
            </label>
            <TextArea
              id="grp-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={t("pages.groups.enterGroupDescription")}
            />
          </div>
        </div>
      </Modal>


      <ConfirmDialog
        open={deleteId != null}
        title={t("pages.groups.deleteConfirm")}
        description={t("pages.groups.deleteConfirmText")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        danger
        loading={deleting}
      />

      <ConfirmDialog
        open={pendingBulk != null}
        title={t("sure")}
        description={
          pendingBulk ? pendingBulkDescription(t, pendingBulk) : undefined
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onCancel={() => setPendingBulk(null)}
        onConfirm={runPendingBulk}
        danger={pendingBulk?.action === "deleteAll"}
        loading={bulkWorking}
      />
    </PageScaffold>
  );
}
