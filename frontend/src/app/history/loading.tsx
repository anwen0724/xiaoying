export default function Loading() {
  return (
    <div aria-busy="true" aria-label="正在加载素材页面">
      <div className="page-heading"><h1>我的素材</h1></div>
      <p role="status">正在加载素材…</p>
      <div className="loading-panel" aria-hidden="true" />
    </div>
  );
}
