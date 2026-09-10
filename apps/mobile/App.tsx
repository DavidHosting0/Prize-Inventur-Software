import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { ProductsScreen } from "./src/screens/ProductsScreen";
import { StockScreen } from "./src/screens/StockScreen";
import { PosScreen } from "./src/screens/PosScreen";
import { styles } from "./src/theme";

type Tab = "dashboard" | "products" | "stock" | "pos";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "dashboard", label: "Home" },
  { id: "products", label: "Products" },
  { id: "stock", label: "Stock" },
  { id: "pos", label: "POS" },
];

function MainApp() {
  const { ready, user } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!ready) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prize Hotel</Text>
        <Text style={styles.headerMeta}>
          {user.hotelName} · {user.roleCode}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "dashboard" ? <DashboardScreen /> : null}
        {tab === "products" ? <ProductsScreen active={tab === "products"} /> : null}
        {tab === "stock" ? <StockScreen active={tab === "stock"} /> : null}
        {tab === "pos" ? <PosScreen active={tab === "pos"} /> : null}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <MainApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
