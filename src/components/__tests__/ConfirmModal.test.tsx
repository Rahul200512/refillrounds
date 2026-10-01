import { fireEvent, render, screen } from '@testing-library/react-native';

import { ConfirmModal } from '../ConfirmModal';

describe('ConfirmModal', () => {
  const props = {
    visible: true,
    title: 'Approve high-cost medication?',
    message: 'Fidaxomicin 200 mg for Harold Brennan.',
    confirmLabel: 'Approve',
  };

  it('shows the title and message and calls the right handlers', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(<ConfirmModal {...props} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText(props.title)).toBeTruthy();
    expect(screen.getByText(props.message)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('confirm-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('confirm-modal-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not confirm while disabled and shows errors', async () => {
    const onConfirm = jest.fn();
    await render(
      <ConfirmModal {...props} confirmDisabled error="Something went wrong" onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    await fireEvent.press(screen.getByTestId('confirm-modal-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});
