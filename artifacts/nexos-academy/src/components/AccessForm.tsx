import { useEffect, useState } from "react";
import { studentRequest, type StudentSession } from "@/lib/academy-session";

interface AccessFormProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onAccountChange: () => void;
}
const getResetToken = () => window.location.hash.startsWith("#reset-password?") ? new URLSearchParams(window.location.hash.split("?")[1]).get("token") ?? "" : "";
export default function AccessForm({ onNavigate, onAccountChange }: AccessFormProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(() => getResetToken() ? "reset" : "login");
  const [recoveryToken, setRecoveryToken] = useState(getResetToken);
  const [session, setSession] = useState<StudentSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [key, setKey] = useState(() => localStorage.getItem("nexos-academy-token") ?? "");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const changed = () => {
      const token = getResetToken();
      if (token) { setRecoveryToken(token); setMode("reset"); setError(""); setMessage(""); }
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    let stopped = false;
    void fetch("/api/academy/student/session", { credentials: "include", cache: "no-store" }).then(async response => {
      if (response.ok) { const data = await response.json(); if (!stopped) setSession(data); }
    }).catch(() => { if (!stopped) setError("Não foi possível verificar sua sessão. Confira sua conexão."); })
      .finally(() => { if (!stopped) setRestoring(false); });
    const ended = () => setSession(null);
    window.addEventListener("academy-session-ended", ended);
    return () => { stopped = true; window.removeEventListener("academy-session-ended", ended); };
  }, []);
  const changeMode = (value: typeof mode) => { setMode(value); setError(""); setMessage(""); setPassword(""); setConfirmation(""); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      if ((mode === "register" || mode === "reset") && password !== confirmation) throw new Error("As senhas não conferem.");
      if (mode === "forgot") {
        const result = await studentRequest("forgot-password", { email: email.trim() }); setMessage(result.message);
      } else if (mode === "reset") {
        await studentRequest("reset-password", { token: recoveryToken, password });
        history.replaceState(null, "", window.location.pathname + "#login");
        setSession(null); changeMode("login"); setMessage("Senha atualizada. Entre com sua nova senha."); onAccountChange();
      } else {
        const result = await studentRequest(mode, { email: email.trim(), password, ...(mode === "register" ? { name: name.trim() } : {}) });
        setSession(result); setPassword(""); setConfirmation(""); onAccountChange();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar."); }
    finally { setLoading(false); }
  }
  async function activate(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const result = await studentRequest("activate", { key: key.trim().toUpperCase() });
      setSession(previous => previous ? { ...previous, products: result.products } : null);
      localStorage.removeItem("nexos-academy-token"); setKey("");
      setMessage("Produto vinculado à sua conta. Use seu e-mail e senha nos próximos acessos."); onAccountChange();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível ativar."); }
    finally { setLoading(false); }
  }
  const input = "w-full min-w-0 px-4 py-3 rounded-lg bg-[hsl(222_25%_10%)] border border-[hsl(220_20%_20%)] text-white text-sm focus:outline-none focus:border-violet-400";
  if (restoring) return <p className="text-center text-sm text-slate-400">Verificando sua sessão…</p>;
  const products = new Set(session?.products.map(product => product.productId));
  return <section className="card-nexos rounded-2xl p-6 sm:p-8 space-y-5">
    {session && mode !== "reset" ? <>
      <div><h1 className="text-2xl font-bold text-white">Minha conta</h1><p className="text-sm text-slate-400 mt-2">{session.user.name} · {session.user.email}</p></div>
      <div className="space-y-3"><h2 className="font-semibold text-white">Meus produtos</h2>
        {products.has("complete-bundle") && <button className="btn-primary w-full" onClick={() => onNavigate("modules")}>Acessar Curso Completo →</button>}
        {(products.has("mini-guide") || products.has("complete-bundle")) && <button className="btn-outline w-full" onClick={() => onNavigate("mini-guide")}>Acessar Mini-Guia 10K →</button>}
        {products.size === 0 && <p className="text-sm text-slate-400">Você ainda não tem produtos ativos. Vincule sua compra com a chave recebida por e-mail.</p>}
      </div>
      <form onSubmit={activate} className="space-y-3 border-t border-white/10 pt-5">
        <label htmlFor="academy-key" className="block text-sm font-semibold text-white">Ativar produto</label>
        <p className="text-xs text-slate-400">Cada chave pode ser vinculada a uma única conta.</p>
        <input id="academy-key" className={input + " font-mono uppercase"} value={key} onChange={event => setKey(event.target.value.toUpperCase())} placeholder="ABCD-EFGH-JKLM" maxLength={64} required autoComplete="off" />
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Ativando…" : "Vincular produto à minha conta"}</button>
      </form>
      <button className="btn-outline w-full" disabled={loading} onClick={async () => {
        setLoading(true); setError("");
        try { await studentRequest("logout"); setSession(null); onAccountChange(); }
        catch (err) { setError(err instanceof Error ? err.message : "Não foi possível sair."); }
        finally { setLoading(false); }
      }}>Sair da conta</button>
    </> : <>
      <div className="space-y-2"><h1 className="text-2xl font-bold text-white">{mode === "register" ? "Crie sua conta" : mode === "forgot" ? "Recuperar senha" : mode === "reset" ? "Criar nova senha" : "Entrar na Academy"}</h1>
        <p className="text-sm text-slate-400">{mode === "register" ? "Depois de criar sua conta, ative seu produto com a chave recebida por e-mail." : mode === "forgot" ? "Enviaremos um link para redefinir sua senha." : mode === "reset" ? "Escolha uma nova senha para sua conta." : "Use seu e-mail e senha. Já tem conta no NexOS? Use os mesmos dados."}</p></div>
      {(mode === "login" || mode === "register") && <div className="grid grid-cols-2 gap-2">
        <button className={mode === "login" ? "btn-primary" : "btn-outline"} onClick={() => changeMode("login")}>Já tenho conta</button>
        <button className={mode === "register" ? "btn-primary" : "btn-outline"} onClick={() => changeMode("register")}>Criar conta</button>
      </div>}
      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && <label className="block text-sm text-slate-300">Nome<input className={input + " mt-2"} value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={200} autoComplete="name" /></label>}
        {mode !== "reset" && <label className="block text-sm text-slate-300">E-mail<input className={input + " mt-2"} type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={255} autoComplete="email" /></label>}
        {mode !== "forgot" && <label className="block text-sm text-slate-300">{mode === "reset" ? "Nova senha" : "Senha"}<input className={input + " mt-2"} type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "login" ? 1 : 8} maxLength={mode === "login" ? 256 : 72} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}
        {(mode === "register" || mode === "reset") && <label className="block text-sm text-slate-300">Confirmar senha<input className={input + " mt-2"} type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" /></label>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Aguarde…" : mode === "register" ? "Criar minha conta" : mode === "forgot" ? "Enviar link de recuperação" : mode === "reset" ? "Salvar nova senha" : "Entrar"}</button>
      </form>
      <button className="text-sm text-violet-400 hover:underline" onClick={() => changeMode(mode === "login" ? "forgot" : "login")}>{mode === "login" ? "Esqueci minha senha" : "Voltar para entrar"}</button>
      <p className="text-xs text-slate-500">Uma sessão por conta. Ao entrar neste dispositivo, o acesso nos outros será encerrado.</p>
    </>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
  </section>;
}
