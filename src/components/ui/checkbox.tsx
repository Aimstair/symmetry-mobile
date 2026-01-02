import * as React from 'react';
import { Pressable, View, ViewProps } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';

/**
 * Checkbox Component - React Native Implementation
 * 
 * Migration Notes:
 * - Custom implementation using Pressable
 * - No HTML checkbox element
 * - Uses lucide Check icon for checked state
 * - Maintains Radix UI-like API with onCheckedChange
 */

export interface CheckboxProps extends Omit<ViewProps, 'children'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const Checkbox = React.forwardRef<View, CheckboxProps>(
  ({ checked = false, onCheckedChange, disabled = false, className, ...props }, ref) => {
    const handlePress = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => ({
          opacity: pressed && !disabled ? 0.7 : 1
        })}
      >
        <View
          ref={ref}
          className={cn(
            'h-5 w-5 rounded border border-primary flex items-center justify-center',
            checked && 'bg-primary',
            disabled && 'opacity-50',
            className || ''
          )}
          {...props}
        >
          {checked && <Check size={14} color="#0A0A0F" strokeWidth={3} />}
        </View>
      </Pressable>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
