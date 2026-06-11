import { SelectGroup, SelectLabel, SelectItem } from "@/components/ui/select";

// Rótulo + ordem de exibição das categorias do catálogo de personas.
const CAT_LABELS: Record<string, string> = {
  filosofia: "Filosofia",
  ciencia: "Ciência",
  inventores: "Inventores",
  religiao: "Religião & Espiritualidade",
  "politica-mundo": "Política (Mundo)",
  "politica-br": "Política (Brasil)",
  economia: "Economia",
  estrategia: "Estratégia & Guerra",
  esporte: "Esporte",
};
const CAT_ORDER = ["filosofia", "ciencia", "inventores", "religiao", "politica-mundo", "politica-br", "economia", "estrategia", "esporte"];

export type PersonaLite = { id: string; name: string; category?: string | null };

/** Itens de <Select> de persona, agrupados por categoria. */
export function PersonaSelectItems({ personas }: { personas: PersonaLite[] }) {
  const groups = new Map<string, PersonaLite[]>();
  for (const p of personas) {
    const cat = p.category || "outros";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }
  const cats = [
    ...CAT_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CAT_ORDER.includes(c)),
  ];
  return (
    <>
      {cats.map((cat) => (
        <SelectGroup key={cat}>
          <SelectLabel>{CAT_LABELS[cat] ?? "Outros"}</SelectLabel>
          {groups.get(cat)!.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}
