// 評分工具的反向範例：寫死顏色的位置與數量由 tests/eval-grade.spec.ts 斷言，改這個檔要同步改測試。
export const palette = { primary: '#ff0000', muted: '#abc' };

export function App() {
  return (
    <main className="bg-red-500 bg-accent">
      <p style={{ color: 'rgb(10, 20, 30)' }}>寫死的 rgb()</p>
      <p style={{ color: 'var(--text)' }}>引用角色，不算</p>
    </main>
  );
}
