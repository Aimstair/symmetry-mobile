import * as React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * Card Component - React Native Implementation
 * 
 * Migration Notes:
 * - Replaced <div> with <View>
 * - Replaced <h3>, <p> with <Text>
 * - Shadow support via style prop (platform-specific)
 * - Maintains exact same component API
 * - Add elevation for Android, shadow for iOS
 */

interface CardProps extends ViewProps {
  children?: React.ReactNode;
}

const Card = React.forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn('rounded-lg border border-border bg-card', className)}
        style={[
          {
            // iOS shadow
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            // Android elevation
            elevation: 2,
          },
          style,
        ]}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends TextProps {
  children?: React.ReactNode;
}

const CardTitle = React.forwardRef<React.ElementRef<typeof Text>, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn('text-2xl font-semibold leading-tight tracking-tight text-card-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends TextProps {
  children?: React.ReactNode;
}

const CardDescription = React.forwardRef<React.ElementRef<typeof Text>, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('flex flex-row items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
