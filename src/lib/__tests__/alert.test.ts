import { Alert, Platform } from 'react-native';
import { showAlert } from '../alert';

describe('showAlert', () => {
  const originalOS = Platform.OS;
  const g = globalThis as unknown as { confirm?: jest.Mock; alert?: jest.Mock };
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    delete g.confirm;
    delete g.alert;
    jest.restoreAllMocks();
  });
  const asWeb = () => Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });

  it('delegates to Alert.alert on native', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const buttons = [{ text: 'OK' }];
    showAlert('Title', 'Body', buttons);
    expect(spy).toHaveBeenCalledWith('Title', 'Body', buttons);
  });

  it('web: confirm OK runs the non-cancel button', () => {
    asWeb();
    g.confirm = jest.fn(() => true);
    const del = jest.fn();
    const cancel = jest.fn();
    showAlert('Delete?', 'Gone forever', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Delete', style: 'destructive', onPress: del },
    ]);
    expect(g.confirm).toHaveBeenCalledWith('Delete?\n\nGone forever');
    expect(del).toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('web: confirm Cancel runs the cancel button only', () => {
    asWeb();
    g.confirm = jest.fn(() => false);
    const del = jest.fn();
    const cancel = jest.fn();
    showAlert('Delete?', undefined, [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Delete', onPress: del },
    ]);
    expect(del).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it('web: no buttons is a plain alert', () => {
    asWeb();
    g.alert = jest.fn();
    showAlert('Save failed', 'Network down');
    expect(g.alert).toHaveBeenCalledWith('Save failed\n\nNetwork down');
  });
});
