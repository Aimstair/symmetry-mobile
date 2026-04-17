import { View, Text } from 'react-native';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useAlertStore } from '@/store/useAlertStore';

export function AppAlertHost() {
  const { open, title, message, buttons, closeAlert, pressButton } = useAlertStore();

  const resolvedButtons = buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' as const }];
  const isHorizontalActions = resolvedButtons.length <= 2;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeAlert()}>
      <DialogContent>
        <DialogHeader onClose={closeAlert}>
          <DialogTitle>{title}</DialogTitle>
          {message ? <DialogDescription>{message}</DialogDescription> : null}
        </DialogHeader>

        <View className={isHorizontalActions ? 'flex-row gap-2 mt-6' : 'gap-2 mt-6'}>
          {resolvedButtons.map((button, index) => {
            const variant =
              button.style === 'destructive'
                ? 'destructive'
                : button.style === 'cancel'
                  ? 'outline'
                  : 'default';

            return (
              <Button
                key={`${button.text || 'action'}-${index}`}
                variant={variant}
                className={isHorizontalActions ? 'flex-1' : 'w-full'}
                onPress={() => pressButton(index)}
              >
                {button.text || 'OK'}
              </Button>
            );
          })}
        </View>
      </DialogContent>
    </Dialog>
  );
}
