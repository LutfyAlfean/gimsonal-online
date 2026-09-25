const ID_KEY = "gimsonal:player-id";
const NAME_KEY = "gimsonal:player-name";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

export function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
