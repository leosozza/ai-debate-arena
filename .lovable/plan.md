## Rebrand: Arena IA → Legends Arena

### 1. Logo (CDN asset)
- Upload via `lovable-assets` do PNG enviado → `src/assets/legends-arena-logo.png.asset.json`.
- Gerar favicon (versão "só portal", sem texto) via `imagegen--edit_image` (crop/foco no portal cyan) → upload como asset → `src/assets/legends-arena-favicon.png.asset.json`.
- Criar `src/components/LegendsLogo.tsx` com prop `size: "sm" | "md" | "lg" | "xl"` e `withWordmark?: boolean` — usa `<img>` apontando para o asset.

### 2. Header (`src/routes/_authenticated/route.tsx`)
- Substituir o quadrado roxo com ícone microfone + texto "Arena IA" por `<LegendsLogo size="sm" />` + texto **"Legends Arena"** em font-display.

### 3. Landing (`src/routes/index.tsx`)
- Logo grande centralizado no hero (`<LegendsLogo size="xl" />`).
- Título: **"Legends Arena"**.
- Tagline: **"Onde lendas atravessam o portal. Você decide quem vence."**
- Atualizar copy secundária mantendo CTAs.

### 4. Auth (`src/routes/auth.tsx`)
- Logo no topo do card (`<LegendsLogo size="lg" />`), substituir texto "Arena IA" por "Legends Arena".

### 5. OpeningSequence (`src/components/OpeningSequence.tsx`)
- Adicionar logo pequeno discreto no topo da tela `step === "title"` acima do "Legends Arena · Hoje no programa".
- Texto já está alinhado ✅.

### 6. Metadados / SEO (`src/routes/__root.tsx`)
- `<title>`: "Legends Arena — Debates épicos entre lendas"
- `meta description`: "Onde lendas atravessam o portal. Debates ao vivo com IA — você decide quem vence."
- `og:site_name`: "Legends Arena"
- `og:title`, `og:description`, `twitter:card`, `twitter:title`, `twitter:description`.
- `<link rel="icon">` → URL do favicon asset.
- Manter root sem `og:image` (regra: og:image só em leaves) — adicionar `og:image` apontando para o logo apenas em `index.tsx`.

### 7. Index head (`src/routes/index.tsx`)
- `head()` próprio: title, description, og:title/description/image (logo), twitter equivalents.

### 8. Nome do app / package
- **Fora de escopo**: `package.json` name e `.lovable/project.json` — apenas branding visível.

### Arquivos editados
- `src/routes/_authenticated/route.tsx`
- `src/routes/index.tsx`
- `src/routes/auth.tsx`
- `src/routes/__root.tsx`
- `src/components/OpeningSequence.tsx`

### Arquivos criados
- `src/assets/legends-arena-logo.png.asset.json`
- `src/assets/legends-arena-favicon.png.asset.json`
- `src/components/LegendsLogo.tsx`

### Riscos
- `imagegen--edit_image` para gerar favicon pode demorar ~30s; se falhar, fallback: usar o logo completo como favicon (menos legível em 16×16 mas funcional).
- Personas/vinhetas já geradas mantêm estética holográfica que combina com o portal do logo — sem retrabalho.
