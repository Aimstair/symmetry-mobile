import * as React from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button Component - React Native Implementation
 * 
 * Migration Notes:
 * - Replaced <button> with <Pressable> for native touch handling
 * - Removed Radix Slot (not needed in React Native)
 * - Added loading state for async operations
 * - Ripple effect on Android, opacity feedback on iOS
 * - Maintains exact same API as web version
 */

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border border-input bg-background',
        secondary: 'bg-secondary',
        ghost: '',
        link: '',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('text-sm font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface ButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Pressable>, 'children'>,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      disabled,
      loading,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        className={({ pressed }) =>
          cn(
            buttonVariants({ variant, size }),
            pressed && !isDisabled && 'opacity-70',
            className
          )
        }
        android_ripple={{
          color: 'rgba(255, 255, 255, 0.1)',
          borderless: false,
        }}
        {...props}
      >
        {({ pressed }) => (
          <View className="flex-row items-center justify-center gap-2">
            {loading && (
              <ActivityIndicator
                size="small"
                color={variant === 'default' ? '#FFFFFF' : undefined}
                className="mr-1"
              />
            )}
            {!loading && leftIcon && <View>{leftIcon}</View>}
            {typeof children === 'string' ? (
              <Text
                className={cn(
                  buttonTextVariants({ variant }),
                  size === 'sm' && 'text-xs',
                  size === 'lg' && 'text-base'
                )}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            {!loading && rightIcon && <View>{rightIcon}</View>}
          </View>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
