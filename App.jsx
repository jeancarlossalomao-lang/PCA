import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from "recharts";
import { quoteCSV } from "./csv.js";

/**
 * PCA UFR – Painel moderno (single-file React)
 * -------------------------------------------------
 * • Pronto para hospedar no GitHub Pages (SPA).
 * • Modo DEMO funciona 100% offline.
 * • Modo LIVE consulta PNCP (substitua os builders de URL se desejar).
 * • Design: Tailwind (já habilitado no ambiente de preview) + Recharts.
 * • Sem dependências externas além de recharts.
 *
 * Como usar no GitHub Pages:
 * - Faça build com qualquer bundler ou use o Preview do Codex.
 * - Este arquivo é auto‑contido (default export App). 
 */

// ------------------------------
// CONFIGURAÇÕES BÁSICAS
// ------------------------------
const DEFAULT_SETTINGS = {
  uasg: "156677", // UFR – UASG (ajuste se necessário)
  year: new Date().getFullYear(),
  dataMode: "DEMO" // "DEMO" | "LIVE"
};

// Paleta para gráficos
const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"]; // azul, verde, amber, vermelho, roxo, ciano, lima

// ------------------------------
// MOCK DEMO DATA (realista)
// ------------------------------
const DEMO = {
  pcaItems: [
    {
      id: 1,
      uorg: "DCL/PROPLAD",
      objeto: "Serviços de manutenção predial e infraestrutura",
      modalidade: "Pregão",
      tipo: "Licitacao",
      estimado: 1250000.0,
      etapa: "ETP",
      mes: 1,
      status: "Em planejamento"
    },
    {
      id: 2,
      uorg: "TI/PROPLAD",
      objeto: "Licenças de software corporativo",
      modalidade: "Dispensa",
      tipo: "Direta",
      estimado: 320000.0,
      etapa: "TR",
      mes: 2,
      status: "Em planejamento"
    },
    {
      id: 3,
      uorg: "PROAD",
      objeto: "Material de consumo laboratorial",
      modalidade: "Pregão",
      tipo: "Licitacao",
      estimado: 480000.0,
      etapa: "Edital",
      mes: 3,
      status: "Publicado"
    },
    {
      id: 4,
      uorg: "PROPLAD",
      objeto: "Serviços de limpeza e conservação",
      modalidade: "Pregão",
      tipo: "Licitacao",
      estimado: 2800000.0,
      etapa: "Julgamento",
      mes: 4,
      status: "Julgamento"
    },
    {
      id: 5,
      uorg: "PROPLAN",
      objeto: "Aquisição de equipamentos de TI",
      modalidade: "Dispensa",
      tipo: "Direta",
      estimado: 700000.0,
      etapa: "Contratação",
      mes: 5,
      status: "Contrato assinado"
    },
    {
      id: 6,
      uorg: "PROGESP",
      objeto: "Serviços de vigilância",
      modalidade: "Pregão",
      tipo: "Licitacao",
      estimado: 3100000.0,
      etapa: "Homologação",
      mes: 6,
      status: "Homologado"
    }
  ],
  monthlyExec: [
    { mes: "Jan", licitado: 0.15, direto: 0.05 },
    { mes: "Fev", licitado: 0.19, direto: 0.08 },
    { mes: "Mar", licitado: 0.27, direto: 0.09 },
    { mes: "Abr", licitado: 0.41, direto: 0.11 },
    { mes: "Mai", licitado: 0.55, direto: 0.18 },
    { mes: "Jun", licitado: 0.68, direto: 0.21 },
    { mes: "Jul", licitado: 0.74, direto: 0.25 },
    { mes: "Ago", licitado: 0.8, direto: 0.28 }
  ],
};

// ------------------------------
// UTILITÁRIOS
// ------------------------------
function fmtCurrency(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState];
}

// Builder (exemplo) — ajuste para PNCP real se desejar
const PNCP = {
  base: "https://pncp.gov.br/api/consulta",
  buildPCAUrl({ uasg, year }) {
    // Substitua pela rota correta quando usar LIVE; mantemos aqui didático.
    // return `${this.base}/pca?uasg=${uasg}&ano=${year}`
    return `${this.base}/swagger-ui/index.html?uasg=${uasg}&ano=${year}`; // placeholder visível
  },
};

async function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

// Adapta dados para o formato usado nos cards/ gráficos
function normalizeFromDemo(demoItems) {
  const totalEstimado = demoItems.reduce((s, it) => s + it.estimado, 0);
  const licitado = demoItems
    .filter((it) => it.tipo === "Licitacao")
    .reduce((s, it) => s + it.estimado, 0);
  const direta = demoItems
    .filter((it) => it.tipo === "Direta")
    .reduce((s, it) => s + it.estimado, 0);
  const exec = 0.72; // taxa de execução simulada
  const economia = totalEstimado * 0.07; // suposição didática

  const byModalidade = Object.values(
    demoItems.reduce((acc, it) => {
      if (!acc[it.modalidade]) acc[it.modalidade] = { name: it.modalidade, value: 0 };
      acc[it.modalidade].value += it.estimado;
      return acc;
    }, {})
  );

  const byTipoMensal = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const l = demoItems.filter((d) => d.mes === m && d.tipo === "Licitacao").reduce((s, x) => s + x.estimado, 0);
    const d = demoItems.filter((d) => d.mes === m && d.tipo === "Direta").reduce((s, x) => s + x.estimado, 0);
    return { mes: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i], Licitação: l, Direta: d };
  });

  return { totalEstimado, licitado, direta, exec, economia, byModalidade, byTipoMensal };
}

// ------------------------------
// COMPONENTES BÁSICOS
// ------------------------------
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl shadow-sm border border-gray-200 bg-white ${className}`}>{children}</div>
  );
}

function CardHeader({ title, action, subtitle }) {
  return (
    <div className="flex items-start justify-between p-4 border-b">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function CardBody({ children, className = "" }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

function Badge({ children, color = "gray" }) {
  const map = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return <span className={`px-2 py-1 text-xs rounded-full ${map[color] || map.gray}`}>{children}</span>;
}

// ------------------------------
// APP PRINCIPAL
// ------------------------------
export default function App() {
  const [settings, setSettings] = useLocalStorage("pca-ufr-settings", DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  // Carrega dados (DEMO ou LIVE)
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError("");
      try {
        if (settings.dataMode === "DEMO") {
          await new Promise(r => setTimeout(r, 500));
          if (!alive) return;
          setRows(DEMO.pcaItems);
        } else {
          // LIVE – ajuste a URL de fato
          const url = PNCP.buildPCAUrl({ uasg: settings.uasg, year: settings.year });
          const data = await fetchWithTimeout(url).catch(() => null);
          if (!alive) return;
          if (!data) throw new Error("Falha ao consultar PNCP (CORS/URL)");
          // TODO: adaptar para o formato abaixo
          setRows([]); // placeholder até ajustar mapeamento
        }
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [settings.dataMode, settings.uasg, settings.year]);

  const kpis = useMemo(() => normalizeFromDemo(rows), [rows]);

  const monthlyLine = useMemo(() => {
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    let pct = 0;
    return months.map((m, i) => {
      // usa DEMO.monthlyExec se disponível, senão acumula por estimado
      const demo = DEMO.monthlyExec[i];
      if (demo) pct = Math.max(pct, Math.round((demo.licitado + demo.direto) * 100) / 100);
      return { mes: m, Execucao: pct };
    });
  }, []);

  // Filtros simples
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    return rows.filter(r => (r.objeto + r.uorg + r.modalidade + r.status).toLowerCase().includes(query.toLowerCase()));
  }, [rows, query]);

  function updateSetting(patch) { setSettings({ ...settings, ...patch }); }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">UFR</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Painel de Contratações – UFR</h1>
              <p className="text-xs text-gray-500">PCA {settings.year} • UASG {settings.uasg}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 rounded-xl border text-sm"
              value={settings.dataMode}
              onChange={(e) => updateSetting({ dataMode: e.target.value })}
              title="Modo de dados"
            >
              <option value="DEMO">DEMO (offline)</option>
              <option value="LIVE">LIVE (PNCP)</option>
            </select>
            <select
              className="px-3 py-2 rounded-xl border text-sm"
              value={settings.year}
              onChange={(e) => updateSetting({ year: Number(e.target.value) })}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <input
              className="px-3 py-2 rounded-xl border text-sm w-44"
              value={settings.uasg}
              onChange={(e) => updateSetting({ uasg: e.target.value })}
              placeholder="UASG"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {error && (
          <Card className="border-red-200">
            <CardBody>
              <div className="text-red-700 text-sm">{error} — Se estiver em LIVE, pode ser CORS. Use DEMO ou configure um proxy/API gateway.</div>
            </CardBody>
          </Card>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader title="Valor Estimado" subtitle="Total do PCA" />
            <CardBody>
              <div className="text-2xl font-semibold">{fmtCurrency(kpis.totalEstimado || 0)}</div>
              <p className="text-xs text-gray-500 mt-1">Soma de todos os itens</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Licitado" subtitle="Planejado via licitação" />
            <CardBody>
              <div className="text-2xl font-semibold">{fmtCurrency(kpis.licitado || 0)}</div>
              <p className="text-xs text-gray-500 mt-1">Pregão/Concorrência/etc.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Contratação Direta" subtitle="Dispensa/INEX" />
            <CardBody>
              <div className="text-2xl font-semibold">{fmtCurrency(kpis.direta || 0)}</div>
              <p className="text-xs text-gray-500 mt-1">Art. 75 e correlatos</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Execução do PCA" subtitle="Taxa acumulada" />
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-semibold">{Math.round((kpis.exec || 0) * 100)}%</div>
                <Badge color="green">Meta 80%</Badge>
              </div>
              <div className="h-2 bg-slate-100 rounded-full mt-3">
                <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.round((kpis.exec || 0) * 100)}%` }} />
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title="Execução ao longo do ano" subtitle="% acumulado" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyLine} margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                  <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                  <Line type="monotone" dataKey="Execucao" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Distribuição por modalidade" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={kpis.byModalidade || []} innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {(kpis.byModalidade || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title="Planejado por mês e tipo" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.byTipoMensal || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={fmtCurrency} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Licitação" fill="#2563eb" stackId="a" />
                  <Bar dataKey="Direta" fill="#10b981" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Economia estimada" subtitle="simulação didática" />
            <CardBody className="h-64 grid place-items-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: "Economia", value: Math.round((kpis.economia / (kpis.totalEstimado || 1)) * 100) }] } startAngle={180} endAngle={0} >
                  <RadialBar dataKey="value" />
                  <Tooltip formatter={(v) => `${v}%`} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="-mt-24 text-center">
                <div className="text-2xl font-semibold">{fmtCurrency(kpis.economia || 0)}</div>
                <p className="text-xs text-gray-500">(≈ {Math.round(((kpis.economia || 0) / (kpis.totalEstimado || 1)) * 100)}% do estimado)</p>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Filtros & Busca */}
        <section className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="flex-1 w-full">
            <input
              className="w-full px-4 py-2 border rounded-xl"
              placeholder="Buscar por objeto, UORG, modalidade, status…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          >
            Imprimir / PDF
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            className="px-4 py-2 rounded-xl border hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        </section>

        {/* Tabela */}
        <Card>
          <CardHeader title="Itens do PCA" subtitle={`${filtered.length} registro(s)`} />
          <CardBody className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">UORG</th>
                  <th className="py-2 pr-4">Objeto</th>
                  <th className="py-2 pr-4">Modalidade</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Etapa</th>
                  <th className="py-2 pr-4">Mês</th>
                  <th className="py-2 pr-4 text-right">Estimado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="py-6 text-center text-gray-500" colSpan={7}>Carregando…</td></tr>
                ) : (
                  filtered.map((it) => (
                    <tr key={it.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4 whitespace-nowrap">{it.uorg}</td>
                      <td className="py-2 pr-4 min-w-[320px]">{it.objeto}</td>
                      <td className="py-2 pr-4">{it.modalidade}</td>
                      <td className="py-2 pr-4">{it.tipo}</td>
                      <td className="py-2 pr-4"><Badge color={it.status.includes("Homolog") ? "green" : it.status.includes("Publicado") ? "blue" : it.status.includes("Julgamento") ? "amber" : "gray"}>{it.status}</Badge></td>
                      <td className="py-2 pr-4">{it.mes.toString().padStart(2, '0')}</td>
                      <td className="py-2 pr-0 text-right font-medium">{fmtCurrency(it.estimado)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>

        {/* Rodapé */}
        <div className="text-xs text-gray-400 py-6 text-center">
          UFR • Painel PCA — demo • Ajuste para LIVE em <code>PNCP.buildPCAUrl()</code>
        </div>
      </main>
    </div>
  );
}

// ------------------------------
// Export helpers
// ------------------------------
function exportCSV(rows) {
  if (!rows?.length) return;
  const header = ["UORG","Objeto","Modalidade","Tipo","Etapa","Mês","Estimado"];
  const body = rows.map(r => [r.uorg, quoteCSV(r.objeto), r.modalidade, r.tipo, r.etapa, r.mes, r.estimado]);
  const csv = [header.join(";"), ...body.map(r => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `pca-ufr-${new Date().getFullYear()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
