'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useIdentity } from './IdentityProvider';
import type { User } from './types';
import styles from './identity.module.css';

export function IdentitySelect({ users, ready }: { users: User[]; ready: boolean }) {
  const { session, generation, changeIdentity } = useIdentity();
  const container = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ generation: number; index: number } | null>(null);
  const search = useRef({ text: '', time: 0 });
  const user = session.status === 'ready' ? session.user : null;
  const options = [{ id: '', displayName: '选择身份' }, ...users];
  const selected = Math.max(0, options.findIndex((option) => option.id === (user?.id ?? '')));
  const disabled = !ready || session.status !== 'ready';
  const open = !disabled && menu?.generation === generation;
  const active = open ? menu.index : selected;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`demo-identity-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function highlight(index: number) {
    setMenu({ generation, index });
  }

  function choose(index: number) {
    setMenu(null);
    if (!disabled && index !== selected) void changeIdentity(options[index].id || null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        highlight(open ? Math.min(active + 1, options.length - 1) : selected);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (open && event.altKey) choose(active);
        else highlight(open ? Math.max(0, active - 1) : selected);
        break;
      case 'Home':
      case 'End':
        event.preventDefault();
        highlight(event.key === 'Home' ? 0 : options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) choose(active);
        else highlight(selected);
        break;
      case 'Escape':
        if (open) event.preventDefault();
        setMenu(null);
        break;
      case 'Tab':
        if (open) choose(active);
        break;
      default:
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        search.current = {
          text: Date.now() - search.current.time < 700 ? search.current.text + event.key : event.key,
          time: Date.now(),
        };
        const match = options.findIndex((option) => option.displayName.startsWith(search.current.text));
        if (match !== -1) highlight(match);
    }
  }

  return (
    <div ref={container} className={styles.select}>
      <button id="demo-identity" type="button" role="combobox" className={styles.trigger}
        aria-labelledby="demo-identity-label" aria-haspopup="listbox" aria-controls="demo-identity-options"
        aria-expanded={open} aria-disabled={disabled}
        aria-activedescendant={open ? `demo-identity-option-${active}` : undefined}
        onClick={() => { if (!disabled) setMenu(open ? null : { generation, index: selected }); }}
        onKeyDown={onKeyDown} onBlur={() => setMenu(null)}>
        <span>{user?.displayName ?? '选择身份'}</span>
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div id="demo-identity-options" role="listbox" aria-labelledby="demo-identity-label" className={styles.options}>
        {options.map((option, index) => (
          <div id={`demo-identity-option-${index}`} key={option.id} role="option"
            aria-selected={index === selected} data-active={index === active} className={styles.option}
            onPointerMove={() => highlight(index)} onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}>
            <span>{option.displayName}</span>
            {index === selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
          </div>
        ))}
      </div>}
    </div>
  );
}
