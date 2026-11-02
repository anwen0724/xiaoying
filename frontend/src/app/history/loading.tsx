export default function Loading() {
  return (
    <div aria-busy="true" aria-label="正在加载历史页面">
      <div className="page-heading"><h1>我的制作记录</h1></div>
      <p role="status">正在加载记录页面…</p>
      <div className="loading-panel" aria-hidden="true" />
    </div>
  );
}
