import * as React from 'react';
import { Text, TextProps } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * Label Component - React Native Implementation
 * 
 * Migration Notes:
 * - Replaced HTML label with Text
 * - Maintains same styling
 * - htmlFor prop removed (not applicable in RN)
 */

export interface LabelProps extends TextProps {
  className?: string;
  children: React.ReactNode;
}

const Label = React.forwardRef<Text, LabelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Text
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </Text>
    );
  }
);

Label.displayName = 'Label';

export { Label };
