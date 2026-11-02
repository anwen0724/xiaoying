export default function Loading() {
  return (
    <div aria-busy="true" aria-label="正在加载页面">
      <div className="page-heading"><h1>正在加载…</h1></div>
      <div className="catalog-grid">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}
