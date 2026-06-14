"use client";

import { Building2, Layers, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { TextareaHTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getJson, postJson, type Msg } from "@/lib/api";
import { panel } from "@/lib/paths";
import { PageScaffold, PageHeader, Surface } from "@/components/panel";
import {
  Button,
  CheckboxField,
  CheckboxOptionCard,
  CheckboxOptionList,
  ConfirmDialog,
  SelectionListToolbar,
  IconTile,
  Input,
  Modal,
  Reveal,
  Spinner,
  useToast,
} from "@/components/ui";

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

  const [hwidGroup, setHwidGroup] = useState<GroupRow | null>(null);
  const [hwidForm, setHwidForm] = useState({ maxHwid: 0, enabled: true });
  const [hwidSubmitting, setHwidSubmitting] = useState(false);

  const [inboundGroup, setInboundGroup] = useState<GroupRow | null>(null);
  const [inbounds, setInbounds] = useState<InboundOption[]>([]);
  const [inboundIds, setInboundIds] = useState<Record<number, boolean>>({});
  const [inboundSubmitting, setInboundSubmitting] = useState(false);
  const inboundDraftGroupIdRef = useRef<number | null>(null);

  // Expiry bulk modal
  const [expiryGroup, setExpiryGroup] = useState<GroupRow | null>(null);
  const [expiryValue, setExpiryValue] = useState<string>(""); // ISO date string
  const [expirySubmitting, setExpirySubmitting] = useState(false);

  // Traffic limit bulk modal
  const [trafficGroup, setTrafficGroup] = useState<GroupRow | null>(null);
  const [trafficGB, setTrafficGB] = useState<number>(0);
  const [trafficSubmitting, setTrafficSubmitting] = useState(false);

  // IP limit bulk modal
  const [ipGroup, setIpGroup] = useState<GroupRow | null>(null);
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
    if (inboundGroup) void loadInbounds();
  }, [inboundGroup, loadInbounds]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", description: "" });
    setFormOpen(true);
  };

  const openEdit = (r: GroupRow) => {
    setEditingId(r.id);
    setForm({ name: r.name, description: r.description });
    setFormOpen(true);
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
        setFormOpen(false);
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

  const openHwidModal = (g: GroupRow) => {
    setBulkGroup(null);
    setHwidGroup(g);
    setHwidForm({ maxHwid: 0, enabled: true });
  };

  const submitHwid = async () => {
    if (hwidGroup == null) return;
    setHwidSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${hwidGroup.id}/bulk/setHwidLimit`),
        {
          maxHwid: Math.max(0, Math.floor(Number(hwidForm.maxHwid)) || 0),
          enabled: hwidForm.enabled,
        },
        true,
      );
      if (r.success) {
        toast.success(
          (r as { msg?: string }).msg ||
            t("success", { defaultValue: "OK" }),
        );
        setHwidGroup(null);
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
      setHwidSubmitting(false);
    }
  };

  const openInboundsModal = (g: GroupRow) => {
    setBulkGroup(null);
    if (inboundDraftGroupIdRef.current !== g.id) {
      setInboundIds({});
      inboundDraftGroupIdRef.current = g.id;
    }
    setInboundGroup(g);
  };

  const backToBulkFromInbounds = () => {
    if (inboundGroup) {
      setBulkGroup(inboundGroup);
    }
    setInboundGroup(null);
  };

  const openExpiryModal = (g: GroupRow) => {
    setBulkGroup(null);
    setExpiryValue("");
    setExpiryGroup(g);
  };

  const submitExpiry = async () => {
    if (expiryGroup == null) return;
    const ts = expiryValue ? new Date(expiryValue).getTime() : 0;
    if (expiryValue && isNaN(ts)) {
      toast.error(t("pages.groups.invalidDate", { defaultValue: "Invalid date" }));
      return;
    }
    setExpirySubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${expiryGroup.id}/bulk/setExpiry`),
        { expiryTime: ts },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        setExpiryGroup(null);
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

  const openTrafficModal = (g: GroupRow) => {
    setBulkGroup(null);
    setTrafficGB(0);
    setTrafficGroup(g);
  };

  const submitTraffic = async () => {
    if (trafficGroup == null) return;
    setTrafficSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${trafficGroup.id}/bulk/setTrafficLimit`),
        { totalGB: Math.max(0, trafficGB) },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        setTrafficGroup(null);
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

  const openIPModal = (g: GroupRow) => {
    setBulkGroup(null);
    setIpForm({ maxIPs: 1, enabled: true });
    setIpGroup(g);
  };

  const submitIP = async () => {
    if (ipGroup == null) return;
    setIpSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${ipGroup.id}/bulk/setIPLimit`),
        { maxIPs: Math.max(0, ipForm.maxIPs), enabled: ipForm.enabled },
        true,
      );
      if (r.success) {
        toast.success((r as { msg?: string }).msg || t("success", { defaultValue: "OK" }));
        setIpGroup(null);
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
    if (inboundGroup == null) return;
    const selected = Object.entries(inboundIds)
      .filter(([, v]) => v)
      .map(([k]) => Number(k))
      .filter((n) => n > 0);
    if (selected.length === 0) {
      toast.error(t("pages.groups.selectAtLeastOneInbound"));
      return;
    }
    setInboundSubmitting(true);
    try {
      const r = await postJson<unknown>(
        panel(`group/${inboundGroup.id}/bulk/assignInbounds`),
        { inboundIds: selected, mode: "replace" },
        true,
      );
      if (r.success) {
        toast.success(
          (r as { msg?: string }).msg || t("pages.groups.inboundsAssigned"),
        );
        inboundDraftGroupIdRef.current = null;
        setInboundIds({});
        setInboundGroup(null);
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
                          title={t("pages.groups.bulkOperations")}
                          onClick={() => setBulkGroup(r)}
                          aria-label={t("pages.groups.bulkOperations")}
                        >
                          <Users size={16} />
                        </Button>
                        <Button
                          variant="secondary"
                          className="!p-2"
                          onClick={() => openEdit(r)}
                          aria-label={t("pages.groups.editGroup")}
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
        onClose={() => setBulkGroup(null)}
        title={
          bulkGroup
            ? `${t("pages.groups.bulkOperations")} — ${bulkGroup.name}`
            : t("pages.groups.bulkOperations")
        }
        width={480}
        footer={
          <Button
            variant="secondary"
            type="button"
            onClick={() => setBulkGroup(null)}
          >
            {t("close")}
          </Button>
        }
      >
        {bulkGroup ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {t("pages.groups.clientDisplay", { count: bulkGroup.clientCount })}
            </p>

            {/* Limits */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                {t("pages.groups.sectionLimits", { defaultValue: "Limits" })}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => openExpiryModal(bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkSetExpiry", { defaultValue: "Set expiry date" })}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => openTrafficModal(bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkSetTrafficLimit", { defaultValue: "Set traffic limit" })}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => openHwidModal(bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkSetHwidLimit")}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => openIPModal(bulkGroup)}
                  disabled={bulkGroup.clientCount < 1}
                >
                  {t("pages.groups.bulkSetIPLimit", { defaultValue: "Set IP limit" })}
                </Button>
              </div>
            </div>

            {/* Routing */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                {t("pages.groups.sectionRouting", { defaultValue: "Routing" })}
              </p>
              <Button
                variant="secondary"
                type="button"
                className="w-full"
                onClick={() => openInboundsModal(bulkGroup)}
                disabled={bulkGroup.clientCount < 1}
                title={t("pages.groups.assignInboundsHint")}
              >
                {t("pages.groups.assignInbounds")}
              </Button>
            </div>

            {/* Status */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
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
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
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

      <Modal
        open={hwidGroup != null}
        onClose={() => {
          if (!hwidSubmitting) setHwidGroup(null);
        }}
        title={t("pages.groups.bulkSetHwidLimitConfirm")}
        width={480}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={hwidSubmitting}
              onClick={() => setHwidGroup(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              type="button"
              loading={hwidSubmitting}
              onClick={() => void submitHwid()}
            >
              {t("apply")}
            </Button>
          </div>
        }
      >
        {hwidGroup ? (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {hwidGroup.name} · {t("pages.groups.clientDisplay", { count: hwidGroup.clientCount })}
            </p>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]"
                htmlFor="hwid-max"
              >
                {t("pages.groups.maxHwid")}
              </label>
              <Input
                id="hwid-max"
                type="number"
                min={0}
                value={String(hwidForm.maxHwid)}
                onChange={(e) =>
                  setHwidForm((f) => ({
                    ...f,
                    maxHwid: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
            <CheckboxField
              checked={hwidForm.enabled}
              onChange={(e) =>
                setHwidForm((f) => ({ ...f, enabled: e.target.checked }))
              }
              label={t("pages.groups.hwidLimitEnabled")}
            />
          </div>
        ) : null}
      </Modal>

      {/* Expiry modal */}
      <Modal
        open={expiryGroup != null}
        onClose={() => { if (!expirySubmitting) setExpiryGroup(null); }}
        title={t("pages.groups.bulkSetExpiry", { defaultValue: "Set expiry date" })}
        width={420}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" type="button" disabled={expirySubmitting} onClick={() => setExpiryGroup(null)}>
              {t("cancel")}
            </Button>
            <Button variant="primary" type="button" loading={expirySubmitting} onClick={() => void submitExpiry()}>
              {t("apply")}
            </Button>
          </div>
        }
      >
        {expiryGroup ? (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {expiryGroup.name} · {t("pages.groups.clientDisplay", { count: expiryGroup.clientCount })}
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]" htmlFor="bulk-expiry-date">
                {t("pages.groups.expiryDate", { defaultValue: "Expiry date (leave blank for unlimited)" })}
              </label>
              <Input
                id="bulk-expiry-date"
                type="datetime-local"
                value={expiryValue}
                onChange={(e) => setExpiryValue(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Traffic limit modal */}
      <Modal
        open={trafficGroup != null}
        onClose={() => { if (!trafficSubmitting) setTrafficGroup(null); }}
        title={t("pages.groups.bulkSetTrafficLimit", { defaultValue: "Set traffic limit" })}
        width={420}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" type="button" disabled={trafficSubmitting} onClick={() => setTrafficGroup(null)}>
              {t("cancel")}
            </Button>
            <Button variant="primary" type="button" loading={trafficSubmitting} onClick={() => void submitTraffic()}>
              {t("apply")}
            </Button>
          </div>
        }
      >
        {trafficGroup ? (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {trafficGroup.name} · {t("pages.groups.clientDisplay", { count: trafficGroup.clientCount })}
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]" htmlFor="bulk-traffic-gb">
                {t("pages.groups.trafficLimitGB", { defaultValue: "Traffic limit (GB, 0 = unlimited)" })}
              </label>
              <Input
                id="bulk-traffic-gb"
                type="number"
                min={0}
                step={0.1}
                value={String(trafficGB)}
                onChange={(e) => setTrafficGB(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* IP limit modal */}
      <Modal
        open={ipGroup != null}
        onClose={() => { if (!ipSubmitting) setIpGroup(null); }}
        title={t("pages.groups.bulkSetIPLimit", { defaultValue: "Set IP limit" })}
        width={420}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" type="button" disabled={ipSubmitting} onClick={() => setIpGroup(null)}>
              {t("cancel")}
            </Button>
            <Button variant="primary" type="button" loading={ipSubmitting} onClick={() => void submitIP()}>
              {t("apply")}
            </Button>
          </div>
        }
      >
        {ipGroup ? (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {ipGroup.name} · {t("pages.groups.clientDisplay", { count: ipGroup.clientCount })}
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]" htmlFor="bulk-ip-max">
                {t("pages.groups.maxIPs", { defaultValue: "Max concurrent IPs" })}
              </label>
              <Input
                id="bulk-ip-max"
                type="number"
                min={0}
                value={String(ipForm.maxIPs)}
                onChange={(e) => setIpForm((f) => ({ ...f, maxIPs: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </div>
            <CheckboxField
              checked={ipForm.enabled}
              onChange={(e) => setIpForm((f) => ({ ...f, enabled: e.target.checked }))}
              label={t("pages.groups.ipLimitEnabled", { defaultValue: "Enable IP limit" })}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={inboundGroup != null}
        onClose={() => {
          if (!inboundSubmitting) setInboundGroup(null);
        }}
        title={t("pages.groups.assignInboundsConfirm")}
        width={520}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={inboundSubmitting}
              onClick={backToBulkFromInbounds}
            >
              {t("back", { defaultValue: "Back" })}
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={inboundSubmitting}
              onClick={() => setInboundGroup(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              type="button"
              loading={inboundSubmitting}
              onClick={() => void submitInbounds()}
            >
              {t("pages.groups.assign")}
            </Button>
          </div>
        }
      >
        {inboundGroup ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-[var(--fg-muted)]">
              {t("pages.groups.assignInboundsHint")}
            </p>
            {inbounds.length === 0 ? (
              <p className="text-xs text-[var(--fg-subtle)]">{t("noData")}</p>
            ) : (
              <CheckboxOptionList
                layout="grid"
                header={
                  <SelectionListToolbar
                    selectedCount={inbounds.filter((ib) => inboundIds[ib.id]).length}
                    totalCount={inbounds.length}
                    onSelectAll={() =>
                      setInboundIds(
                        Object.fromEntries(inbounds.map((ib) => [ib.id, true])),
                      )
                    }
                    onSelectNone={() => setInboundIds({})}
                    selectAllLabel={t("pages.groups.selectAllInbounds", {
                      defaultValue: "Select all",
                    })}
                    selectNoneLabel={t("pages.groups.selectNoneInbounds", {
                      defaultValue: "Clear",
                    })}
                  />
                }
              >
                {inbounds.map((ib) => (
                  <CheckboxOptionCard
                    key={ib.id}
                    icon={Layers}
                    checked={!!inboundIds[ib.id]}
                    onChange={(e) =>
                      setInboundIds((m) => ({
                        ...m,
                        [ib.id]: e.target.checked,
                      }))
                    }
                    heading={ib.remark?.trim() || `Inbound ${ib.id}`}
                    description={`${ib.protocol} · :${ib.port}`}
                  />
                ))}
              </CheckboxOptionList>
            )}
          </div>
        ) : null}
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
