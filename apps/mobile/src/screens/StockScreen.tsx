import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch, ApiRequestError } from "../api";
import { useFocusEffect } from "../useFocusEffect";
import { colors, styles } from "../theme";

type StockRow = {
  id: string;
  quantity: string | number;
  product: {
    id: string;
    name: string;
    sku: string;
    minStock: string | number;
    unit: string;
  };
  warehouse: { id: string; name: string };
};

export function StockScreen({ active }: { active: boolean }) {
  const [items, setItems] = useState<StockRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const data = await apiFetch<{ items: StockRow[] }>(`/api/v1/stock${query}`);
      setItems(data.items);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Failed to load stock"
      );
    } finally {
      setLoading(false);
    }
  }, [q]);

  useFocusEffect(load, active);

  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <Text style={styles.title}>Lager</Text>
        <Text style={styles.subtitle}>Central stock</Text>
        <TextInput
          style={styles.input}
          placeholder="Filter by product…"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          returnKeyType="search"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No stock rows</Text>}
          renderItem={({ item }) => {
            const qty = Number(item.quantity);
            const min = Number(item.product.minStock);
            const low = qty < min;
            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>
                    {item.product.name}
                  </Text>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: low ? colors.danger : colors.ink,
                    }}
                  >
                    {qty} {item.product.unit}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  SKU {item.product.sku} · Min {min}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
