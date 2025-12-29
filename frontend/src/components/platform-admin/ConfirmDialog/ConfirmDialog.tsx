import React from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  Stack,
  Icon,
  Text,
  useTheme
} from '@fluentui/react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  const theme = useTheme();

  const variantConfig = {
    danger: {
      iconName: 'ErrorBadge',
      iconColor: theme.palette.redDark,
      backgroundColor: '#fef0f0',
    },
    warning: {
      iconName: 'Warning',
      iconColor: theme.palette.orangeLight,
      backgroundColor: '#fff8f0',
    },
    info: {
      iconName: 'Info',
      iconColor: theme.palette.themePrimary,
      backgroundColor: '#f0f6ff',
    },
  };

  const config = variantConfig[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onClose}
      dialogContentProps={{
        type: DialogType.normal,
        title: (
          <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: config.backgroundColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                iconName={config.iconName}
                styles={{
                  root: {
                    fontSize: 24,
                    color: config.iconColor,
                  },
                }}
              />
            </div>
            <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
              {title}
            </Text>
          </Stack>
        ),
      }}
      modalProps={{
        isBlocking: true,
        styles: {
          main: {
            maxWidth: 450,
          },
        },
      }}
    >
      <Text variant="medium" styles={{ root: { padding: '16px 0' } }}>
        {message}
      </Text>

      <DialogFooter>
        <DefaultButton onClick={onClose} text={cancelText} />
        <PrimaryButton
          onClick={handleConfirm}
          text={confirmText}
          styles={{
            root: {
              backgroundColor: variant === 'danger' ? theme.palette.redDark : theme.palette.themePrimary,
              border: 'none',
            },
            rootHovered: {
              backgroundColor: variant === 'danger' ? theme.palette.red : theme.palette.themeDark,
            },
          }}
        />
      </DialogFooter>
    </Dialog>
  );
};
