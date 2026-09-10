import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL_KEY = "prize.apiUrl";
const TOKEN_KEY = "prize.accessToken";
const USER_KEY = "prize.user";

export const DEFAULT_API_URL = "http://192.168.1.25:3000";

export type MobileUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  roleCode: string;
  hotelId: string;
  permissions: string[];
  locale: string;
  currency: string;
  hotelLocale: string;
  hotelName: string;
};

async function setSecure(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getSecure(key: string) {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteSecure(key: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getApiUrl() {
  return (await AsyncStorage.getItem(API_URL_KEY)) ?? DEFAULT_API_URL;
}

export async function setApiUrl(url: string) {
  const cleaned = url.trim().replace(/\/$/, "");
  await AsyncStorage.setItem(API_URL_KEY, cleaned);
}

export async function getAccessToken() {
  return getSecure(TOKEN_KEY);
}

export async function getStoredUser(): Promise<MobileUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileUser;
  } catch {
    return null;
  }
}

export async function saveSession(accessToken: string, user: MobileUser) {
  await setSecure(TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await deleteSecure(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

type ApiError = { error?: string; code?: string };

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const base = await getApiUrl();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = (data ?? {}) as ApiError;
    throw new ApiRequestError(
      err.error || `Request failed (${res.status})`,
      res.status,
      err.code
    );
  }

  return data as T;
}

export async function mobileLogin(email: string, password: string) {
  return apiFetch<{
    accessToken: string;
    user: MobileUser;
  }>("/api/v1/auth/mobile-login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}
