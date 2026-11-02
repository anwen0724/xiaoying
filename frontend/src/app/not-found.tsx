import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="panel">
      <h1>页面不存在</h1>
      <p className="subtitle">这个地址没有可浏览的内容。</p>
      <Link href="/" className="back-link">返回模板库</Link>
    </section>
  );
}
