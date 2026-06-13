import { fetchJson } from "./api";

export async function sendMessageToChat(message) {
  return fetchJson("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
}
