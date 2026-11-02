// 評分工具的正向範例：只用變數與角色 class，寫死顏色數必須是 0。
import type { CSSProperties } from 'react';

export function App() {
  return (
    <main className="bg-accent text-muted border-border/40" style={{ color: 'var(--text)', '--local': '#123456' } as CSSProperties}>
      <p style={{ background: 'var(--surface, #fff)' }}>變數的備用值不算</p>
    </main>
  );
}
