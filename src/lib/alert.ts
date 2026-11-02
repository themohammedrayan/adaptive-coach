import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in for Alert.alert that also works on web, where react-native-web's
 * Alert.alert is a silent no-op. On web: no/one button → window.alert, then
 * that button's onPress; otherwise window.confirm, running the (last)
 * non-cancel button on OK and the cancel button on Cancel. Callers never
 * offer more than one non-cancel choice, so confirm() is sufficient.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];
  const cancel = list.find((b) => b.style === 'cancel');
  const actions = list.filter((b) => b !== cancel);
  if (actions.length === 0 || (actions.length === 1 && !cancel)) {
    globalThis.alert?.(text);
    (actions[0] ?? cancel)?.onPress?.();
    return;
  }
  const ok = globalThis.confirm?.(text) ?? false;
  if (ok) actions[actions.length - 1].onPress?.();
  else cancel?.onPress?.();
}
