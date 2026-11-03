'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MainNavigation() {
  const pathname = usePathname();
  const catalogCurrent = pathname === '/' ? 'page' : pathname.startsWith('/templates/') ? 'location' : undefined;
  return (
    <nav className="main-nav" aria-label="主导航">
      <Link href="/" aria-current={catalogCurrent}>模板库</Link>
      <Link href="/history" aria-current={pathname === '/history' ? 'page' : undefined}>我的素材</Link>
    </nav>
  );
}
