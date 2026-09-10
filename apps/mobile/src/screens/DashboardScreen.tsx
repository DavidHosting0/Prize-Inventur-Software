import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "../useFocusEffect";
import { apiFetch, ApiRequestError } from "../api";
import { useAuth } from "../auth";
import { styles } from "../theme";

type DashboardSummary = {
  currency: string;
  kpis: {
    revenueToday: number;
    revenueWeek: number;
    salesCount: number;
    stockValue: number;
    criticalItems: number;
    belowMin: number;
    openInventoryCounts: number;
  };
  criticalProducts: Array<{
    id: string;
    name: string;
    qty: number;
    min: number;
  }>;
};

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CHF",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${currency}`;
  }
}

export function DashboardScreen() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const summary = await apiFetch<DashboardSummary>(
        "/api/v1/dashboard/summary"
      );
      setData(summary);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(load);

  if (loading && !data) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.padded}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} />
      }
    >
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>
        {user?.hotelName} · {user?.name}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data ? (
        <>
          <View style={styles.kpiGrid}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Revenue today</Text>
              <Text style={styles.kpiValue}>
                {money(data.kpis.revenueToday, data.currency)}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Sales today</Text>
              <Text style={styles.kpiValue}>{data.kpis.salesCount}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Stock value</Text>
              <Text style={styles.kpiValue}>
                {money(data.kpis.stockValue, data.currency)}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Critical items</Text>
              <Text style={styles.kpiValue}>{data.kpis.criticalItems}</Text>
            </View>
          </View>

          <Text style={[styles.title, { fontSize: 18, marginTop: 20 }]}>
            Low stock
          </Text>
          {data.criticalProducts.length === 0 ? (
            <Text style={styles.empty}>No critical products</Text>
          ) : (
            data.criticalProducts.map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardMeta}>
                  Qty {p.qty} · Min {p.min}
                </Text>
              </View>
            ))
          )}
        </>
      ) : null}

      <Pressable style={[styles.secondaryButton, { marginTop: 20 }]} onPress={logout}>
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
