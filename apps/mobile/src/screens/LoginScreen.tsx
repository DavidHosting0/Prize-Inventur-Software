import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth";
import { ApiRequestError, getApiUrl, setApiUrl } from "../api";
import { colors, styles } from "../theme";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@demo-hotel.ch");
  const [password, setPassword] = useState("Demo123!");
  const [apiUrl, setApiUrlState] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    getApiUrl().then(setApiUrlState);
  }, []);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (apiUrl.trim()) {
        await setApiUrl(apiUrl);
      }
      await login(email, password);
    } catch (e) {
      const message =
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Login failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, styles.padded, { justifyContent: "center" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Prize Hotel</Text>
      <Text style={styles.subtitle}>Sign in to manage stock and POS</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => setShowSettings((v) => !v)}
      >
        <Text style={styles.secondaryButtonText}>
          {showSettings ? "Hide API settings" : "API settings"}
        </Text>
      </Pressable>

      {showSettings ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={apiUrl}
            onChangeText={setApiUrlState}
            placeholder="http://192.168.1.25:3000"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.cardMeta}>
            Use your LAN IP for a physical device. Android emulator: http://10.0.2.2:3000.
            iOS simulator: http://localhost:3000.
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
