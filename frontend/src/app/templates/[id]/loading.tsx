export default function Loading() {
  return (
    <div aria-busy="true" aria-label="正在加载制作页面">
      <div className="page-heading"><h1>正在加载模板…</h1></div>
      <div className="creation-layout" aria-hidden="true">
        <div className="creation-input">
          <div className="loading-panel" />
          <div className="loading-panel" />
        </div>
        <div className="loading-panel" />
      </div>
    </div>
  );
}
