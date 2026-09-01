"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "tc-visit-v1";

function sessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "anon";
  }
}

function send(payload: Record<string, string>) {
  const body = JSON.stringify({
    ...payload,
    sessionId: sessionId(),
    referrer: document.referrer || "",
  });
  void fetch("/api/admin/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function clickLabel(node: EventTarget | null): { href: string; label: string } | null {
  if (!(node instanceof Element)) return null;
  const target = node.closest("a, button, [role='button'], input, select, textarea, label");
  if (!target || !(target instanceof HTMLElement)) return null;
  if (target.closest("[data-admin-ignore]")) return null;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" && (target as HTMLInputElement).type === "password") return null;
  const href = target instanceof HTMLAnchorElement ? target.getAttribute("href") ?? "" : "";
  const text = (target.innerText || target.getAttribute("aria-label") || tag)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return { href, label: `${tag}${text ? ` · ${text}` : ""}` };
}

export function AdminTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    send({ kind: "page", path: pathname });
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const path = window.location.pathname;
      if (path.startsWith("/admin") || path.startsWith("/api")) return;
      const hit = clickLabel(event.target);
      if (!hit) return;
      send({ kind: "click", path, href: hit.href, label: hit.label });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
