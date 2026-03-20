
---

## 1) Princípios de UI (pra guiar todas as telas)

* **Monocromático primeiro**: preto/branco/cinza; cor só pra *status* e *ação*.
* **Hierarquia agressiva**: títulos grandes, subtítulos secos, labels discretos.
* **Espaçamento generoso**: cards com padding bom, listas com respiro.
* **Componentes poucos e consistentes**: evita “cada tela um estilo”.
* **Feedback imediato**: badge de status, toast, loading discreto.

---

## 2) Design tokens (cores, tipografia, radius, sombra)

### Cores (Nike-ish)

* Base: **preto e branco**
* Neutros: cinzas pra borda/texto secundário
* Acento (opcional): **Volt/verde-lima** só para CTA e destaque (bem pontual)
* Status: cores sem gritar demais

### Tipografia

* Sistema (Inter) ou a própria `ui-sans` do Tailwind
* Títulos grandes e pesados; corpo limpo

### Rounding e sombra

* Nike tende a ser mais “sharp”, mas pra B2B fica bom:

  * **2xl** nos cards, **xl** nos inputs
  * Sombra suave (quase imperceptível)

---

## 3) Implementação no projeto (Tailwind + shadcn/ui)

### 3.1 Instalar shadcn/ui

No seu projeto Next:

```bash
npx shadcn@latest init
```

Escolha:

* **Style:** New York (fica mais clean)
* **Base color:** Neutral
* **CSS variables:** Yes

Depois instale os componentes que vamos usar:

```bash
npx shadcn@latest add button badge card input textarea select tabs table dropdown-menu separator dialog toast tooltip popover calendar
```

---

## 4) Globals: tema “Nike-like” via CSS variables

Em `src/app/globals.css`, mantenha o base do shadcn e ajuste tokens:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Nike-like: bem neutro */
    --background: 0 0% 100%;
    --foreground: 0 0% 6%;

    --card: 0 0% 100%;
    --card-foreground: 0 0% 6%;

    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 6%;

    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 40%;

    --border: 0 0% 90%;
    --input: 0 0% 90%;

    /* Accent “volt” (bem controlado) */
    --primary: 0 0% 6%;
    --primary-foreground: 0 0% 98%;

    --accent: 76 100% 50%; /* volt-ish */
    --accent-foreground: 0 0% 6%;

    --ring: 0 0% 10%;

    --radius: 1rem; /* 16px, cara premium */
  }

  .dark {
    --background: 0 0% 6%;
    --foreground: 0 0% 98%;

    --card: 0 0% 8%;
    --card-foreground: 0 0% 98%;

    --popover: 0 0% 8%;
    --popover-foreground: 0 0% 98%;

    --muted: 0 0% 14%;
    --muted-foreground: 0 0% 68%;

    --border: 0 0% 18%;
    --input: 0 0% 18%;

    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 8%;

    --accent: 76 100% 50%;
    --accent-foreground: 0 0% 6%;

    --ring: 0 0% 90%;
  }
}
```

> Você pode rodar em **dark mode** também — fica muito “Nike app”.

---

## 5) Tipografia e layout base

Crie um utilitário de container (padrão em todo lugar):

```tsx
// src/components/layout/Container.tsx
export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      {children}
    </div>
  );
}
```

Títulos padrão:

* H1: `text-3xl md:text-4xl font-semibold tracking-tight`
* Sub: `text-sm text-muted-foreground`
* Seção: `text-lg font-medium`

---

## 6) Componentes “base” do seu design system

### 6.1 Botões (CTA e secundários)

Use o `Button` do shadcn, mas defina um “CTA volt” (bem Nike):

```tsx
// src/components/ui/cta.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CTAButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90",
        className
      )}
      {...props}
    />
  );
}
```

Regra:

* **Primary normal** = preto/branco
* **CTA** = volt (só em ação principal: “Criar auditoria”, “Concluir”, “Exportar”)

---

### 6.2 Badges de status (o coração do BIM Audit)

Crie um `StatusBadge` bem consistente:

```tsx
// src/components/audit/StatusBadge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ItemStatus = "NOT_STARTED" | "CONFORMING" | "NONCONFORMING" | "OBSERVATION" | "NA";

const map = {
  NOT_STARTED: { label: "Não iniciado", cls: "bg-muted text-foreground border" },
  CONFORMING: { label: "Conforme", cls: "bg-emerald-600 text-white border-transparent" },
  NONCONFORMING: { label: "Não conforme", cls: "bg-red-600 text-white border-transparent" },
  OBSERVATION: { label: "Observação", cls: "bg-amber-500 text-black border-transparent" },
  NA: { label: "N/A", cls: "bg-zinc-400 text-black border-transparent" },
} as const;

export function StatusBadge({ status }: { status: ItemStatus }) {
  const s = map[status];
  return <Badge className={cn("rounded-full px-3 py-1", s.cls)}>{s.label}</Badge>;
}
```

> Se quiser 100% monocromático (bem Nike), dá pra trocar cores por **bordas e ícones** — mas pra auditoria, cor ajuda MUITO.

---

### 6.3 “Audit Item Card” (padrão de execução)

Esse card vira o template do seu sistema:

```tsx
// src/components/audit/AuditItemCard.tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";

type Props = {
  discipline: string;
  category: string;
  description: string;
  status: "NOT_STARTED" | "CONFORMING" | "NONCONFORMING" | "OBSERVATION" | "NA";
};

export function AuditItemCard(props: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">
              {props.discipline} • {props.category}
            </div>
            <div className="text-base font-medium leading-snug">
              {props.description}
            </div>
          </div>
          <StatusBadge status={props.status} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm">Não iniciado</Button>
          <Button variant="outline" size="sm">Conforme</Button>
          <Button variant="outline" size="sm">Não conforme</Button>
          <Button variant="outline" size="sm">Observação</Button>
          <Button variant="outline" size="sm">N/A</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Textarea placeholder="Evidência / Observação" className="min-h-[96px] rounded-xl" />

        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Rastreio Construflow (ID/URL)" className="rounded-xl" />
          <Input type="date" className="rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}
```

**Regrinhas UX** (bem importante):

* Quando status = **Não conforme**, mostre um “hint” e valide:

  * evidência obrigatória
  * construflow obrigatório
  * próxima revisão obrigatória

---

### 6.4 Layout da tela de execução (bem Nike: lista limpa + filtros)

Topo com título grande e chips de filtro:

* Título: Auditoria, obra e fase
* Ações: Exportar, Concluir
* Filtros: Disciplina, Status, “Só NC”, “Com revisão vencida”

---

## 7) Padrão de páginas (templates)

### 7.1 Página de Lista de Auditorias

* Header grande
* Search + filtros
* Cards simples (minimal)

Classes úteis:

* Card: `rounded-2xl border bg-card`
* Linha: `flex items-center justify-between gap-4`

### 7.2 Página “Dashboard” da Auditoria

* 3 cards no topo:

  * Score geral
  * Pendências
  * Revisões próximas
* Abaixo: tabela “NCs” (pra ação rápida)

### 7.3 Página “Execução”

* Lista de `AuditItemCard`
* Paginação/virtualização depois (se ficar grande)

---

## 8) Componentes que valem ouro pro seu PRD

### “ScoreCard”

* mostra % e barra de progresso
* sem frescura

### “NC Table”

* tabela com: disciplina, item, status, construflow, revisão

### “Quick Edit”

* editar status inline sem abrir modal

---

## 9) Checklist de consistência visual (pra manter o padrão)

* Botão primário quase sempre **preto** (ou branco no dark)
* Volt só pra:

  * criar auditoria
  * concluir auditoria
  * exportar / ação principal
* Tudo em **cards** com borda leve
* Nada de background colorido espalhado
* Status sempre com badge no canto

---

## 10) Quer que eu já aplique isso no seu projeto?

Se você me disser:

1. **Light ou Dark como padrão?**
2. Você quer “**cores por status**” (como mandei) ou **monocromático por borda/ícone**?
3. Você quer uma navegação lateral (sidebar) ou topo simples?

Mesmo sem você responder, eu consigo seguir com um padrão “seguro”:

* **Light default**
* **cores por status**
* **sidebar minimal** (Auditorias / Obras / Biblioteca / Usuários)

Se quiser, no próximo passo eu já te entrego:

* `AppShell` (sidebar + header Nike-ish)
* página `Auditorias` com filtro
* página `Execução` com `AuditItemCard` pronto pra plugar na API.
