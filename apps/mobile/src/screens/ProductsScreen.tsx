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

type Product = {
  id: string;
  name: string;
  sku: string;
  salePrice: string | number;
  unit: string;
  category?: { name: string } | null;
};

export function ProductsScreen({ active }: { active: boolean }) {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const data = await apiFetch<{ items: Product[] }>(
        `/api/v1/products${query}`
      );
      setItems(data.items);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Failed to load products"
      );
    } finally {
      setLoading(false);
    }
  }, [q]);

  useFocusEffect(load, active);

  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <Text style={styles.title}>Products</Text>
        <TextInput
          style={styles.input}
          placeholder="Search name, SKU, barcode…"
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
          ListEmptyComponent={
            <Text style={styles.empty}>No products found</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {item.sku}
                {item.category?.name ? ` · ${item.category.name}` : ""}
              </Text>
              <Text style={[styles.cardMeta, { marginTop: 6 }]}>
                {Number(item.salePrice).toFixed(2)} / {item.unit}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
