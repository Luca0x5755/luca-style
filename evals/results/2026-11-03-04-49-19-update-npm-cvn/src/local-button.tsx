import { Button, type ButtonProps } from '@luca-style/react';

// 本地改動：每個按鈕都帶 data-local-change="orders"。只用套件的公開 API，套件更新時這個包裝不會被覆蓋。
export function LocalButton(props: ButtonProps) {
  return <Button data-local-change="orders" {...props} />;
}
