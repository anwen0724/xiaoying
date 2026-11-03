import type { Metadata } from 'next';
import Link from 'next/link';
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { IdentityPicker } from '../features/identity/IdentityPicker';
import { MainNavigation } from './MainNavigation';
import './globals.css';

export const metadata: Metadata = {
  title: '小影 · 素材制作',
  description: '选择模板，上传图片，提交模拟制作任务。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <IdentityProvider>
          <a className="skip-link" href="#main-content">跳到主要内容</a>
          <header className="app-header">
            <div className="header-inner">
              <Link className="brand" href="/" aria-label="小影素材制作，返回模板库">
                <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <rect x="3" y="7" width="20" height="22" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M10 3h16a3 3 0 0 1 3 3v16M7 23l5-6 4 4 3-3" stroke="currentColor" strokeWidth="2" />
                </svg>
                小影 <span className="brand-note">素材制作</span>
              </Link>
              <MainNavigation />
              <IdentityPicker />
            </div>
          </header>
          <main className="canvas" id="main-content" tabIndex={-1}>{children}</main>
        </IdentityProvider>
      </body>
    </html>
  );
}
