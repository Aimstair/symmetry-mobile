import * as React from 'react';
import { Animated, View, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

interface SkeletonProps extends ViewProps {
  pulseDurationMs?: number;
}

export const Skeleton = React.forwardRef<React.ElementRef<typeof View>, SkeletonProps>(
  ({ className, style, pulseDurationMs = 850, ...props }, ref) => {
    const opacity = React.useRef(new Animated.Value(0.45)).current;

    React.useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: pulseDurationMs,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.45,
            duration: pulseDurationMs,
            useNativeDriver: true,
          }),
        ])
      );

      loop.start();
      return () => {
        loop.stop();
      };
    }, [opacity, pulseDurationMs]);

    return (
      <Animated.View
        ref={ref}
        className={cn('bg-muted rounded-md', className)}
        style={[{ opacity }, style]}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
