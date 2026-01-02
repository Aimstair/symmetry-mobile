import * as React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * Input Component - React Native Implementation
 * 
 * Migration Notes:
 * - Replaced HTML input with TextInput
 * - Added proper keyboard types for number inputs
 * - NativeWind classes applied directly
 * - Auto-detect number type for keyboardType
 */

export interface InputProps extends TextInputProps {
  className?: string;
  error?: string;
}

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, error, ...props }, ref) => {
    // Auto-detect keyboard type from keyboardType prop
    const keyboardType = props.keyboardType || 'default';
    const autoCapitalize = props.autoCapitalize || 'sentences';

    return (
      <View>
        <TextInput
          ref={ref}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor="#71717A" // muted-foreground
          className={cn(
            'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            'focus:border-ring focus:outline-none disabled:opacity-50',
            error && 'border-destructive',
            className
          )}
          {...props}
        />
        {error && (
          <Text className="text-xs text-destructive mt-1">{error}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
