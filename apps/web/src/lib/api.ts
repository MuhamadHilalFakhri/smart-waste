"use client";
import { ApiClient } from "@smart-waste/api-client";
export const api = new ApiClient({
  baseUrl: "/api/v1",
  onUnauthorized: () => window.dispatchEvent(new Event("sw:unauthorized")),
});
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
