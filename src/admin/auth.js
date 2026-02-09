import { toast } from "../ui/toast.js";

const KEY = "premiumShell.adminSession.v1";

// Change these later (or replace with backend auth)
const DEFAULT_USER = "admin";
const DEFAULT_PASS = "admin";

export function isAuthed() {
  return localStorage.getItem(KEY) === "1";
}

export function logout() {
  localStorage.removeItem(KEY);
}

export function login(user, pass) {
  const ok = (user === DEFAULT_USER && pass === DEFAULT_PASS);
  if (ok) {
    localStorage.setItem(KEY, "1");
    toast("Login OK");
    return true;
  }
  toast("Usuário/senha inválidos");
  return false;
}
