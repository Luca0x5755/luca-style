// 三個入口：index 與 baseline 比對 preflight 的影響，probes 放角色與傳入 class 的探針。
export default {build: {rollupOptions: {input: ['index.html', 'baseline.html', 'probes.html']}}};
