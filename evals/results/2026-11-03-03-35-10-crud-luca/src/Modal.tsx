import { useEffect, useRef, type ReactNode } from 'react';

type ModalProps = {
  title: string;
  titleId: string;
  role?: 'dialog' | 'alertdialog';
  onClose: () => void;
  children: ReactNode;
};

/** 以原生 <dialog> 實作的強制回應視窗：焦點限制在視窗內，Esc 關閉，關閉後焦點回到原處。 */
export function Modal({ title, titleId, role = 'dialog', onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      role={role}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
