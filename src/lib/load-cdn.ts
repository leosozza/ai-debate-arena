// Carrega um módulo ESM de uma CDN, 100% no navegador, via <script type=module>.
// NÃO usa import() de URL nem eval/new Function — o import fica dentro de uma
// string em textContent, invisível pro bundler. Assim o bundle do servidor
// (Cloudflare Workers) não contém nada que o deploy possa rejeitar.
const cache = new Map<string, Promise<unknown>>();

export function loadCdnModule(url: string): Promise<unknown> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("loadCdnModule: só no navegador"));
  }
  const cached = cache.get(url);
  if (cached) return cached;

  const p = new Promise<unknown>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    const key = `__cdn_cb_${cache.size}_${url.length}`;
    w[key] = (m: unknown) => { try { delete w[key]; } catch { /* ignore */ } resolve(m); };
    const errKey = `${key}_err`;
    w[errKey] = (msg: unknown) => { try { delete w[errKey]; } catch { /* ignore */ } reject(new Error(String(msg))); };

    const s = document.createElement("script");
    s.type = "module";
    // O import() vive DENTRO desta string → o bundler não o vê como import.
    s.textContent =
      `import(${JSON.stringify(url)})` +
      `.then(function(m){window[${JSON.stringify(key)}](m);})` +
      `.catch(function(e){window[${JSON.stringify(errKey)}](e&&e.message?e.message:"falha ao carregar");});`;
    s.onerror = () => reject(new Error(`CDN falhou: ${url}`));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("CDN timeout")), 90000);
  });

  cache.set(url, p);
  // Se falhar, permite nova tentativa.
  p.catch(() => cache.delete(url));
  return p;
}
