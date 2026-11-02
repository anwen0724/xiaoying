'use client';

export default function PageError({ reset }: { reset: () => void }) {
  return (
    <section className="panel" role="alert">
      <h1>页面暂时无法显示</h1>
      <p className="subtitle">请重试加载。已经受理的任务会继续执行。</p>
      <button type="button" onClick={reset}>重新加载页面</button>
    </section>
  );
}
