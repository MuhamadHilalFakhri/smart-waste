import * as SecureStore from "expo-secure-store";
import { ApiClient, type Tokens } from "@smart-waste/api-client";
export const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
const expiryListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void) {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}
export async function getTokens(): Promise<Tokens | null> {
  const value = await SecureStore.getItemAsync("sw-session");
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    await SecureStore.deleteItemAsync("sw-session");
    return null;
  }
}
export const api = new ApiClient({
  baseUrl: apiUrl,
  mobile: true,
  getTokens,
  onUnauthorized: () => expiryListeners.forEach((listener) => listener()),
  setTokens: async (tokens) => {
    if (tokens)
      await SecureStore.setItemAsync("sw-session", JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync("sw-session");
  },
});
