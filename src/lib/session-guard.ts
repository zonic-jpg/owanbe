/**
 * Surfaces the one-time "your session was reset" notice fired by the
 * Supabase client (see integrations/supabase/client.ts) when a stale/foreign
 * auth token fails its signature check. Without this, that failure repeated
 * silently (or as a raw error) on every subsequent authenticated click.
 *
 * Plain DOM, no React dependency, so it can be installed once at boot
 * alongside installAsset404Listener() regardless of where in the tree the
 * failing request happened.
 */
let installed = false;

export function installSessionExpiredListener() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("supabase:session-expired", () => {
    if (document.getElementById("session-expired-banner")) return;
    const bar = document.createElement("div");
    bar.id = "session-expired-banner";
    bar.setAttribute("role", "status");
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:9999;" +
      "background:#111827;color:#fff;padding:12px 16px;font:14px/1.4 system-ui,sans-serif;" +
      "display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;" +
      "box-shadow:0 -4px 20px rgba(0,0,0,.25)";
    bar.innerHTML =
      '<span>Your session expired — sign in again to continue.</span>' +
      '<button type="button" style="background:#fff;color:#111827;border:0;border-radius:6px;' +
      'padding:6px 14px;font-weight:600;cursor:pointer">Reload</button>';
    bar.querySelector("button")?.addEventListener("click", () => window.location.reload());
    document.body.appendChild(bar);
  });
}
