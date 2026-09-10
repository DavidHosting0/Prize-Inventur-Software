"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { toNumber } from "@/lib/money";
import { FormSplitLayout } from "@/components/form-split-layout";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";
import { HardwareBarcodeInput, UnknownBarcodeActions } from "@/components/barcode";
import { resolveBarcode } from "@/lib/barcode-client";
import { useSession } from "next-auth/react";

export default function MinibarPage() {
  const t = useTranslations("minibar");
  const tb = useTranslations("barcode");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const canCreate =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");
  const qc = useQueryClient();

  const [roomNumber, setRoomNumber] = useState("");
  const [product, setProduct] = useState<{ id: string; name: string } | null>(
    null
  );
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filterRoom, setFilterRoom] = useState("");
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["minibar", filterRoom],
    queryFn: async () => {
      const q = filterRoom ? `?room=${encodeURIComponent(filterRoom)}` : "";
      return (await fetch(`/api/v1/minibar${q}`)).json();
    },
  });

  async function onScan(code: string) {
    setError(null);
    setUnknownCode(null);
    const result = await resolveBarcode(code);
    if (result.status === "found") {
      setProduct({ id: result.product.id, name: result.product.name });
      return;
    }
    if (result.status === "unknown") {
      setUnknownCode(result.code);
      setProduct(null);
      return;
    }
    if (result.status === "inactive") {
      setError(tb("productInactive"));
      setProduct(null);
      return;
    }
    setError(result.message);
    setProduct(null);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!product || !roomNumber.trim()) throw new Error("Missing fields");
      const res = await fetch("/api/v1/minibar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomNumber: roomNumber.trim(),
          productId: product.id,
          quantity: qty,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error");
      }
      return res.json();
    },
    onSuccess: () => {
      setProduct(null);
      setQty(1);
      setNotes("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["minibar"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const items = list.data?.items ?? [];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.minibar") }]}
    >
      <p className="mb-4 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-muted)]">
        {t("noRoomCharge")}
      </p>

      <FormSplitLayout
        form={
          <Card>
            <CardHeader>{t("record")}</CardHeader>
            <CardBody className="space-y-3">
              <div>
                <Label>{t("room")}</Label>
                <Input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="412"
                />
              </div>
              <div>
                <Label>{t("scanBarcode")}</Label>
                <HardwareBarcodeInput onScan={onScan} placeholder={t("scanBarcode")} />
                {unknownCode ? (
                  <div className="mt-2">
                    <UnknownBarcodeActions
                      code={unknownCode}
                      canCreate={canCreate}
                      returnTo="/minibar"
                      onCancel={() => setUnknownCode(null)}
                    />
                  </div>
                ) : null}
                {product ? (
                  <div className="mt-2 text-sm">
                    <Badge>{product.name}</Badge>
                  </div>
                ) : null}
              </div>
              <div>
                <Label>{t("quantity")}</Label>
                <Input
                  type="number"
                  min={0.001}
                  step="0.001"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>{t("notes")}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error ? <InlineAlert>{error}</InlineAlert> : null}
              <Button
                variant="success"
                onClick={() => createMutation.mutate()}
                disabled={!product || !roomNumber || createMutation.isPending}
              >
                <Plus className="h-4 w-4" />
                {t("save")}
              </Button>
            </CardBody>
          </Card>
        }
        list={
          <DataTablePanel
            title={t("history")}
            toolbar={
              <Input
                className="max-w-xs"
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                placeholder={t("allRooms")}
              />
            }
            empty={items.length === 0 ? tc("noRows") : undefined}
          >
            {items.length > 0 ? (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>{t("room")}</th>
                    <th>{t("product")}</th>
                    <th>{t("quantity")}</th>
                    <th>{t("when")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(
                    (row: {
                      id: string;
                      roomNumber: string;
                      quantity: string | number;
                      createdAt: string;
                      product: { name: string };
                    }) => (
                      <tr key={row.id}>
                        <td>{row.roomNumber}</td>
                        <td>{row.product.name}</td>
                        <td>{toNumber(row.quantity)}</td>
                        <td className="text-xs text-[var(--text-dim)]">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            ) : null}
          </DataTablePanel>
        }
      />
    </AppShell>
  );
}
