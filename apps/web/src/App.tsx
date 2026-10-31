import { FormEvent, useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const platforms = ['xiaohongshu', 'douyin', 'kuaishou', 'wechat_channels', 'weibo', 'bilibili'];
const labels: Record<string, string> = {
  xiaohongshu: '小红书', douyin: '抖音', kuaishou: '快手', wechat_channels: '视频号', weibo: '微博', bilibili: 'B站'
};

type Account = { id: string; platform: string; displayName: string; authStatus: string; authMode?: string; expiresAt?: string | null };
type Job = {
  id: string;
  platform: string;
  title?: string | null;
  content?: string | null;
  status: string;
  scheduledFor?: string | null;
  retryCount?: number;
  lastError?: string | null;
  createdAt: string;
};
type Asset = { id: string; kind: string; fileName: string; storageUrl: string; createdAt?: string };
type Confirmation = { publishJobId: string; platform?: string; title?: string; status?: string; createdAt?: string };

function getAdminToken() {
  return sessionStorage.getItem('nowju_admin_token')?.trim() || '';
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const adminToken = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;

  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body?.message || body?.error || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pending, setPending] = useState<Confirmation[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminToken, setAdminToken] = useState(() => getAdminToken());

  async function refresh() {
    setLoading(true); setMessage('');
    try {
      const [a, j, m, p] = await Promise.all([
        json<Account[]>('/platform-accounts'), json<Job[]>('/publish-jobs'), json<Asset[]>('/media-assets'), json<Confirmation[]>('/publish-confirmations/pending')
      ]);
      setAccounts(a); setJobs(j); setAssets(m); setPending(p);
    } catch (e) {
      const detail = (e as Error).message;
      setMessage(detail === 'UNAUTHORIZED' ? '需要管理员令牌：请在顶部输入后保存。' : `连接失败：${detail}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const counts = useMemo(() => ({
    accounts: accounts.length,
    connected: accounts.filter(a => a.authStatus === 'connected' || a.authStatus === 'authorized').length,
    jobs: jobs.length,
    pending: pending.length,
    failed: jobs.filter(j => j.status === 'failed' || j.status === 'needs_auth').length,
    assets: assets.length,
  }), [accounts, jobs, pending, assets]);

  async function saveAdminToken(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = adminToken.trim();
    if (token) sessionStorage.setItem('nowju_admin_token', token);
    else sessionStorage.removeItem('nowju_admin_token');
    await refresh();
  }

  async function clearAdminToken() {
    sessionStorage.removeItem('nowju_admin_token');
    setAdminToken('');
    setAccounts([]); setJobs([]); setAssets([]); setPending([]);
    setMessage('管理员令牌已从当前浏览器会话清除。');
  }

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    try {
      await json('/platform-accounts', { method: 'POST', body: JSON.stringify({ platform: fd.get('platform'), displayName: fd.get('displayName'), authMode: 'human_confirmation' }) });
      e.currentTarget.reset(); await refresh();
    } catch (err) { setMessage(`添加账号失败：${(err as Error).message}`); }
  }

  async function createJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const scheduledFor = String(fd.get('scheduledFor') || '').trim();
    try {
      await json('/publish-jobs', {
        method: 'POST',
        body: JSON.stringify({
          platform: fd.get('platform'),
          title: fd.get('title'),
          content: fd.get('content'),
          scheduledFor: scheduledFor || undefined,
        }),
      });
      e.currentTarget.reset(); await refresh();
    } catch (err) { setMessage(`创建任务失败：${(err as Error).message}`); }
  }

  async function createAsset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    try {
      await json('/media-assets', { method: 'POST', body: JSON.stringify({ kind: fd.get('kind'), fileName: fd.get('fileName'), storageUrl: fd.get('storageUrl') }) });
      e.currentTarget.reset(); await refresh();
    } catch (err) { setMessage(`登记素材失败：${(err as Error).message}`); }
  }

  async function decide(id: string, decision: 'approved' | 'rejected') {
    try {
      await json(`/publish-confirmations/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
      await refresh();
    } catch (err) { setMessage(`处理确认失败：${(err as Error).message}`); }
  }

  async function taskAction(id: string, action: 'cancel' | 'retry') {
    try {
      await json(`/publish-jobs/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      await refresh();
    } catch (err) { setMessage(`${action === 'retry' ? '重试' : '取消'}失败：${(err as Error).message}`); }
  }

  return <div className="app">
    <header className="topbar">
      <div><span className="eyebrow">NOWJU / 发布中控</span><h1>Publish OS</h1><p>内容生产 · 平台账号 · 发布队列 · 人工确认</p></div>
      <div className="actions">
        <form className="inline" onSubmit={saveAdminToken}>
          <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} placeholder="管理员令牌" autoComplete="off" />
          <button type="submit">保存令牌</button>
          {getAdminToken() && <button type="button" className="danger" onClick={clearAdminToken}>清除</button>}
        </form>
        <button className="primary" onClick={refresh}>{loading ? '刷新中…' : '刷新全部'}</button>
      </div>
    </header>

    {message && <div className="alert">{message}</div>}

    <section className="stats">
      <Stat n={counts.connected} label="可用账号" />
      <Stat n={counts.jobs} label="发布任务" />
      <Stat n={counts.pending} label="待你确认" hot />
      <Stat n={counts.failed} label="需处理" hot={counts.failed > 0} />
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

      <Panel title="新建发布任务" subtitle="支持立即排队或指定时间发布">
        <form className="stack" onSubmit={createJob}>
          <select name="platform" required>{platforms.map(p => <option key={p} value={p}>{labels[p]}</option>)}</select>
          <input name="title" placeholder="内容标题 / 任务名" required />
          <textarea name="content" placeholder="正文 / 发布说明（可选）" rows={4} />
          <label>定时发布（可选）<input name="scheduledFor" type="datetime-local" /></label>
          <button className="primary">加入发布队列</button>
        </form>
        <div className="list compact">
          {jobs.length ? jobs.slice(0, 10).map(j => <div className="row" key={j.id}>
            <div>
              <strong>{labels[j.platform] || j.platform} · {j.title || '未命名'}</strong>
              <span>{j.status}{j.scheduledFor ? ` · ${new Date(j.scheduledFor).toLocaleString()}` : ''}{j.retryCount ? ` · 重试 ${j.retryCount}` : ''}</span>
              {j.lastError && <span>错误：{j.lastError}</span>}
            </div>
            <div className="actions">
              {(j.status === 'failed' || j.status === 'needs_auth') && <button onClick={() => taskAction(j.id, 'retry')}>重试</button>}
              {!['published', 'cancelled'].includes(j.status) && <button className="danger" onClick={() => taskAction(j.id, 'cancel')}>取消</button>}
              <em>{j.status}</em>
            </div>
          </div>) : <Empty text="还没有发布任务" />}
        </div>
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
