import { create } from 'zustand';

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AppAlertButton {
  text?: string;
  style?: AppAlertButtonStyle;
  onPress?: () => void;
}

interface AlertState {
  open: boolean;
  title: string;
  message: string;
  buttons: AppAlertButton[];
  showAlert: (title: string, message?: string, buttons?: AppAlertButton[]) => void;
  closeAlert: () => void;
  pressButton: (index: number) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  open: false,
  title: '',
  message: '',
  buttons: [],

  showAlert: (title, message = '', buttons = [{ text: 'OK', style: 'default' }]) =>
    set({
      open: true,
      title,
      message,
      buttons: buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
    }),

  closeAlert: () =>
    set({
      open: false,
      title: '',
      message: '',
      buttons: [],
    }),

  pressButton: (index) => {
    const { buttons, closeAlert } = get();
    const button = buttons[index];

    closeAlert();

    if (button?.onPress) {
      setTimeout(() => {
        button.onPress?.();
      }, 0);
    }
  },
}));

export function showAppAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  useAlertStore.getState().showAlert(title, message, buttons);
}
