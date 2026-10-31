import { FormEvent, useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const platforms = ['xiaohongshu', 'douyin', 'kuaishou', 'wechat_channels', 'weibo', 'bilibili'];
const labels: Record<string, string> = {
  xiaohongshu: '小红书', douyin: '抖音', kuaishou: '快手', wechat_channels: '视频号', weibo: '微博', bilibili: 'B站'
};

type Account = { id: string; platform: string; displayName: string; authStatus: string; authMode?: string; expiresAt?: string | null };
type Job = { id: string; platform: string; title?: string | null; status: string; createdAt: string };
type Asset = { id: string; kind: string; fileName: string; storageUrl: string; createdAt?: string };
type Confirmation = { publishJobId: string; platform?: string; title?: string; status?: string; createdAt?: string };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pending, setPending] = useState<Confirmation[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true); setMessage('');
    try {
      const [a, j, m, p] = await Promise.all([
        json<Account[]>('/platform-accounts'), json<Job[]>('/publish-jobs'), json<Asset[]>('/media-assets'), json<Confirmation[]>('/publish-confirmations/pending')
      ]);
      setAccounts(a); setJobs(j); setAssets(m); setPending(p);
    } catch (e) { setMessage(`连接失败：${(e as Error).message}`); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const counts = useMemo(() => ({
    accounts: accounts.length,
    connected: accounts.filter(a => a.authStatus === 'connected' || a.authStatus === 'authorized').length,
    jobs: jobs.length,
    pending: pending.length,
    assets: assets.length,
  }), [accounts, jobs, pending, assets]);

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    await json('/platform-accounts', { method: 'POST', body: JSON.stringify({ platform: fd.get('platform'), displayName: fd.get('displayName'), authMode: 'human_confirmation' }) });
    e.currentTarget.reset(); refresh();
  }

  async function createJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    await json('/publish-jobs', { method: 'POST', body: JSON.stringify({ platform: fd.get('platform'), title: fd.get('title') }) });
    e.currentTarget.reset(); refresh();
  }

  async function createAsset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    await json('/media-assets', { method: 'POST', body: JSON.stringify({ kind: fd.get('kind'), fileName: fd.get('fileName'), storageUrl: fd.get('storageUrl') }) });
    e.currentTarget.reset(); refresh();
  }

  async function decide(id: string, decision: 'approved' | 'rejected') {
    await json(`/publish-confirmations/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
    refresh();
  }

  return <div className="app">
    <header className="topbar">
      <div><span className="eyebrow">NOWJU / 发布中控</span><h1>Publish OS</h1><p>内容生产 · 平台账号 · 发布队列 · 人工确认</p></div>
      <button className="primary" onClick={refresh}>{loading ? '刷新中…' : '刷新全部'}</button>
    </header>

    {message && <div className="alert">{message}</div>}

    <section className="stats">
      <Stat n={counts.connected} label="可用账号" />
      <Stat n={counts.jobs} label="发布任务" />
      <Stat n={counts.pending} label="待你确认" hot />
      <Stat n={counts.assets} label="素材记录" />
    </section>

    <main className="grid">
      <Panel title="平台账号" subtitle="先登记账号，真实授权后再切换状态">
        <form className="inline" onSubmit={createAccount}>
          <select name="platform" required>{platforms.map(p => <option key={p} value={p}>{labels[p]}</option>)}</select>
          <input name="displayName" placeholder="账号名称" required />
          <button>添加账号</button>
        </form>
        <div className="list">{accounts.length ? accounts.map(a => <Row key={a.id} title={`${labels[a.platform] || a.platform} · ${a.displayName}`} meta={`状态 ${a.authStatus} · ${a.authMode || '未设置'}`} />) : <Empty text="还没有平台账号" />}</div>
      </Panel>

      <Panel title="新建发布任务" subtitle="进入队列后自动记录状态与重试">
        <form className="stack" onSubmit={createJob}>
          <select name="platform" required>{platforms.map(p => <option key={p} value={p}>{labels[p]}</option>)}</select>
          <input name="title" placeholder="内容标题 / 任务名" required />
          <button className="primary">加入发布队列</button>
        </form>
        <div className="list compact">{jobs.slice(0, 8).map(j => <Row key={j.id} title={`${labels[j.platform] || j.platform} · ${j.title || '未命名'}`} meta={j.status} badge={j.status} />)}</div>
      </Panel>

      <Panel title="待确认发布" subtitle="任何需要人工把关的平台都会停在这里">
        <div className="list">{pending.length ? pending.map(p => <div className="confirm" key={p.publishJobId}>
          <div><strong>{p.title || p.publishJobId}</strong><span>{labels[p.platform || ''] || p.platform || '平台待确认'}</span></div>
          <div className="actions"><button className="approve" onClick={() => decide(p.publishJobId, 'approved')}>批准</button><button className="danger" onClick={() => decide(p.publishJobId, 'rejected')}>拒绝</button></div>
        </div>) : <Empty text="当前没有待确认任务" />}</div>
      </Panel>

      <Panel title="素材库" subtitle="先登记存储地址，后续接腾讯云 COS / CloudBase">
        <form className="stack" onSubmit={createAsset}>
          <select name="kind"><option value="video">视频</option><option value="image">图片</option><option value="cover">封面</option></select>
          <input name="fileName" placeholder="文件名" required />
          <input name="storageUrl" placeholder="存储 URL" required />
          <button>登记素材</button>
        </form>
        <div className="list compact">{assets.slice(0, 6).map(a => <Row key={a.id} title={a.fileName} meta={`${a.kind} · ${a.storageUrl}`} />)}</div>
      </Panel>
    </main>

    <footer>API: {API} · 当前六个平台默认采用人工确认模式</footer>
  </div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panelHead"><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>;
}
function Stat({ n, label, hot }: { n: number; label: string; hot?: boolean }) { return <div className={`stat ${hot ? 'hot' : ''}`}><strong>{n}</strong><span>{label}</span></div>; }
function Row({ title, meta, badge }: { title: string; meta: string; badge?: string }) { return <div className="row"><div><strong>{title}</strong><span>{meta}</span></div>{badge && <em>{badge}</em>}</div>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
