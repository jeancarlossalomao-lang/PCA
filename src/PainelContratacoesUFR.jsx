import React, { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

// =============================
// Painel de Contratações – UFR
// UASG: 156677 | CNPJ: 35854176000195
// APIs: dadosabertos.compras.gov.br (Módulos: UASG, Contratações/Contratos)
// =============================

// Helper: formatters
const brl = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(Number(v || 0));
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

function useFetchJson(url, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancel = false;
    if (!enabled || !url) return;
    setLoading(true);
    setError(null);
    fetch(url, { headers: { accept: "*/*" } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!cancel) setData(j);
      })
      .catch((e) => !cancel && setError(e))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [url, enabled]);
  return { data, loading, error };
}

async function fetchAllPages(baseUrl, pageParam = "pagina", maxPages = 60) {
  const out = [];
  let page = 1;
  for (; page <= maxPages; page++) {
    const u = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${pageParam}=${page}`;
    const r = await fetch(u, { headers: { accept: "*/*" } });
    if (!r.ok) throw new Error(`Falha ao obter página ${page}: HTTP ${r.status}`);
    const j = await r.json();
    const arr = j?.resultado || [];
    out.push(...arr);
    const totalPaginas = j?.totalPaginas ?? page;
    if (page >= totalPaginas || arr.length === 0) break;
  }
  return out;
}

export default function PainelContratacoesUFR() {
  // Filtros
  const UASG = "156677";
  const CNPJ = "35854176000195"; // UFR

  const yearNow = new Date().getFullYear();
  const [anoInicial, setAnoInicial] = useState(yearNow - 2);
  const [anoFinal, setAnoFinal] = useState(yearNow);
  const [busy, setBusy] = useState(false);
  const [uasgInfo, setUasgInfo] = useState(null);
  const [orgaoInfo, setOrgaoInfo] = useState(null);
  const [contratos, setContratos] = useState([]);
  const [errGlobal, setErrGlobal] = useState("");

  const base = "https://dadosabertos.compras.gov.br";

  // Carregar dados da UASG e do Órgão (para obter codigoOrgao)
  const uasgUrl = `${base}/modulo-uasg/1_consultarUasg?codigoUasg=${UASG}&statusUasg=true&pagina=1`;
  const orgaoUrl = `${base}/modulo-uasg/2_consultarOrgao?cnpjCpfOrgao=${CNPJ}&statusOrgao=true&pagina=1`;
  const { data: uasgRaw } = useFetchJson(uasgUrl);
  const { data: orgaoRaw } = useFetchJson(orgaoUrl);

  useEffect(() => {
    setUasgInfo(uasgRaw?.resultado?.[0] || null);
  }, [uasgRaw]);
  useEffect(() => {
    setOrgaoInfo(orgaoRaw?.resultado?.[0] || null);
  }, [orgaoRaw]);

  async function carregarContratos() {
    if (!orgaoInfo?.codigoOrgao) return;
    setBusy(true);
    setErrGlobal("");
    try {
      const all = [];
      for (let y = anoInicial; y <= anoFinal; y++) {
        const url = `${base}/modulo-contratos/1_consultarContratos?codigoOrgao=${orgaoInfo.codigoOrgao}&dataVigenciaInicialMin=${y}-01-01&dataVigenciaInicialMax=${y}-12-31&tamanhoPagina=500`;
        const registros = await fetchAllPages(url);
        all.push(...registros);
      }
      setContratos(all);
    } catch (e) {
      console.error(e);
      setErrGlobal(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Auto-carregar ao obter orgaoInfo
    if (orgaoInfo?.codigoOrgao) carregarContratos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgaoInfo, anoInicial, anoFinal]);

  const resumo = useMemo(() => {
    if (!contratos?.length) return null;
    const total = contratos.length;
    let soma = 0, maior = 0;
    contratos.forEach((c) => {
      const v = Number(c?.valorGlobal || 0);
      soma += v;
      if (v > maior) maior = v;
    });
    const media = soma / (total || 1);

    // Top fornecedores
    const porFornecedor = new Map();
    contratos.forEach((c) => {
      const k = c?.nomeRazaoSocialFornecedor || c?.niFornecedor || "(sem fornecedor)";
      porFornecedor.set(k, (porFornecedor.get(k) || 0) + Number(c?.valorGlobal || 0));
    });
    const topFornecedores = [...porFornecedor.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, valor]) => ({ nome, valor }));

    // Por modalidade
    const porModalidade = new Map();
    contratos.forEach((c) => {
      const k = c?.nomeModalidadeCompra || c?.codigoModalidadeCompra || "(não informado)";
      porModalidade.set(k, (porModalidade.get(k) || 0) + 1);
    });
    const distModalidades = [...porModalidade.entries()].map(([nome, qtde]) => ({ nome, qtde }));

    // Série mensal por vigência inicial
    const porMes = new Map();
    contratos.forEach((c) => {
      const d = c?.dataVigenciaInicial;
      const v = Number(c?.valorGlobal || 0);
      const year = d ? new Date(d).getFullYear() : null;
      if (!year || year < anoInicial || year > anoFinal) return;
      const label = new Date(d).toISOString().slice(0, 7); // yyyy-MM
      porMes.set(label, (porMes.get(label) || 0) + v);
    });
    const serieMensal = [...porMes.entries()]
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([mes, valor]) => ({ mes, valor }));

    // Lista recente
    const recentes = [...contratos]
      .sort((a, b) => new Date(b?.dataVigenciaInicial || 0) - new Date(a?.dataVigenciaInicial || 0))
      .slice(0, 12);

    return { total, soma, maior, media, topFornecedores, distModalidades, serieMensal, recentes };
  }, [contratos, anoInicial, anoFinal]);

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Painel de Contratações – UFR
            </h1>
            <p className="text-sm text-slate-600">
              UASG {UASG}{" "}
              {uasgInfo?.nomeUasg ? `· ${uasgInfo.nomeUasg}` : ""} · CNPJ {CNPJ}
            </p>
            {orgaoInfo?.nomeOrgao && (
              <p className="text-sm text-slate-600">Órgão: {orgaoInfo.nomeOrgao} (código {orgaoInfo.codigoOrgao})</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white shadow rounded-2xl px-3 py-2">
              <label className="text-sm">De</label>
              <select
                className="bg-transparent outline-none"
                value={anoInicial}
                onChange={(e) => setAnoInicial(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => yearNow - i)
                  .sort((a, b) => a - b)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
              <label className="text-sm">até</label>
              <select
                className="bg-transparent outline-none"
                value={anoFinal}
                onChange={(e) => setAnoFinal(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => yearNow - i)
                  .sort((a, b) => a - b)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
              <button
                onClick={carregarContratos}
                className="ml-2 rounded-2xl px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={busy || !orgaoInfo?.codigoOrgao}
                title="Atualizar dados"
              >
                {busy ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>
        </header>

        {errGlobal && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Falha ao obter dados: {String(errGlobal)}. Tente novamente ou ajuste o período.
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard title="Contratos" value={resumo?.total ?? 0} sub={anoInicial === anoFinal ? `${anoInicial}` : `${anoInicial}–${anoFinal}`} />
          <KpiCard title="Valor Global" value={brl(resumo?.soma ?? 0)} sub="soma do período" />
          <KpiCard title="Maior Contrato" value={brl(resumo?.maior ?? 0)} />
          <KpiCard title="Ticket Médio" value={brl(resumo?.media ?? 0)} />
        </section>

        {/* Gráficos */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 rounded-3xl bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">Valor contratado por mês (vigência inicial)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={resumo?.serieMensal || []} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={brl} width={90} />
                  <Tooltip formatter={(v) => brl(v)} labelFormatter={(l) => l} />
                  <Area type="monotone" dataKey="valor" stroke="#0ea5e9" fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">Modalidades (Qtde)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={resumo?.distModalidades || []} nameKey="nome" dataKey="qtde" outerRadius={90}>
                    {(resumo?.distModalidades || []).map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-3xl bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">Top Fornecedores por Valor</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(resumo?.topFornecedores || []).map((d) => ({ ...d, label: d.nome.slice(0, 24) + (d.nome.length > 24 ? "…" : "") }))} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tickFormatter={brl} width={90} />
                  <Tooltip formatter={(v) => brl(v)} labelFormatter={(l) => l} />
                  <Bar dataKey="valor" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">Status</h2>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>
                <b>UASG:</b> {UASG} · {uasgInfo?.nomeUasg || "Carregando…"}
              </li>
              <li>
                <b>Órgão (código):</b> {orgaoInfo?.nomeOrgao || "-"} ({orgaoInfo?.codigoOrgao || "-"})
              </li>
              <li>
                <b>Período:</b> {anoInicial} – {anoFinal}
              </li>
              <li>
                <b>Registros carregados:</b> {contratos?.length || 0}
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Fonte: dadosabertos.compras.gov.br (módulos UASG e Contratos). Em alguns ambientes, políticas de CORS do
              provedor podem impedir o carregamento direto via navegador. Se ocorrer, publique este painel em um ambiente
              com proxy (Next.js API Route / Cloudflare Worker) ou habilite o domínio na sua rede.
            </p>
          </div>
        </section>

        {/* Tabela de contratos recentes */}
        <section className="rounded-3xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold">Contratos mais recentes (vigência inicial)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Contrato</th>
                  <th className="py-2 pr-4">Fornecedor</th>
                  <th className="py-2 pr-4">Objeto</th>
                  <th className="py-2 pr-4">Vigência</th>
                  <th className="py-2 pr-4">Modalidade</th>
                  <th className="py-2 pr-4 text-right">Valor Global</th>
                </tr>
              </thead>
              <tbody>
                {(resumo?.recentes || []).map((c, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{c?.numeroContrato || "—"}</td>
                    <td className="py-2 pr-4">{c?.nomeRazaoSocialFornecedor || "—"}</td>
                    <td className="py-2 pr-4 max-w-[520px]">{(c?.objeto || "—").slice(0, 160)}{(c?.objeto?.length > 160 ? "…" : "")}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(c?.dataVigenciaInicial)} – {fmtDate(c?.dataVigenciaFinal)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{c?.nomeModalidadeCompra || c?.codigoModalidadeCompra || "—"}</td>
                    <td className="py-2 pl-4 text-right font-medium">{brl(c?.valorGlobal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-8 text-xs text-slate-500">
          <p>
            *Este painel é um protótipo em arquivo único. Para produção, recomendo migrar para Next.js, adicionar rotas de
            API como proxy (para paginação e CORS) e implementar cache de 6–24h.
          </p>
        </footer>
      </div>
    </div>
  );
}

function KpiCard({ title, value, sub }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-slate-500 mt-1">{sub}</div> : null}
    </div>
  );
}

