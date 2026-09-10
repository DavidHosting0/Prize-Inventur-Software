import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { apiFetch, ApiRequestError } from "../api";
import { useFocusEffect } from "../useFocusEffect";
import { colors, styles } from "../theme";

type Product = {
  id: string;
  name: string;
  salePrice: string | number;
  unit: string;
};

type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export function PosScreen({ active }: { active: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const prod = await apiFetch<{ items: Product[] }>(
        "/api/v1/products?pageSize=100"
      );
      setProducts(prod.items);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Failed to load POS data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(load, active);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart]
  );

  function addProduct(product: Product) {
    setMessage(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.salePrice),
          quantity: 1,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: l.quantity + delta }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  async function checkout(method: "CASH" | "CARD") {
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setPaying(true);
    setError(null);
    setMessage(null);
    try {
      const sale = await apiFetch<{ id: string; total: string | number }>(
        "/api/v1/sales",
        {
          method: "POST",
          body: JSON.stringify({
            items: cart.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
            })),
          }),
        }
      );

      await apiFetch(`/api/v1/sales/${sale.id}`, {
        method: "POST",
        body: JSON.stringify({
          action: "pay",
          method,
          amount: Number(sale.total),
        }),
      });

      setCart([]);
      setMessage(`Paid ${Number(sale.total).toFixed(2)} via ${method}`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (loading && products.length === 0) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <Text style={styles.title}>POS</Text>
        <Text style={styles.subtitle}>Pick products, then pay</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? (
          <Text style={[styles.error, { color: colors.success }]}>{message}</Text>
        ) : null}
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => addProduct(item)}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {Number(item.salePrice).toFixed(2)} / {item.unit}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>+ Add</Text>
            </View>
          </Pressable>
        )}
      />

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.card,
          padding: 16,
        }}
      >
        {cart.length === 0 ? (
          <Text style={styles.cardMeta}>Cart empty — tap products above</Text>
        ) : (
          cart.map((line) => (
            <View key={line.productId} style={[styles.row, { marginBottom: 8 }]}>
              <Text style={{ flex: 1, color: colors.ink }}>
                {line.name} × {line.quantity}
              </Text>
              <Pressable onPress={() => changeQty(line.productId, -1)} style={{ padding: 6 }}>
                <Text style={{ fontWeight: "700", color: colors.accent }}>−</Text>
              </Pressable>
              <Pressable onPress={() => changeQty(line.productId, 1)} style={{ padding: 6 }}>
                <Text style={{ fontWeight: "700", color: colors.accent }}>+</Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={[styles.cardTitle, { marginVertical: 8 }]}>
          Total {total.toFixed(2)}
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={[styles.button, { flex: 1 }, paying && styles.buttonDisabled]}
            disabled={paying}
            onPress={() => checkout("CASH")}
          >
            <Text style={styles.buttonText}>Cash</Text>
          </Pressable>
          <Pressable
            style={[styles.button, { flex: 1, backgroundColor: colors.ink }, paying && styles.buttonDisabled]}
            disabled={paying}
            onPress={() => checkout("CARD")}
          >
            <Text style={styles.buttonText}>Card</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
