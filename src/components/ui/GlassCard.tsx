import * as React from 'react';
import { View, ViewProps, Pressable } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * GlassCard Component - React Native Implementation
 * 
 * Migration Notes:
 * - Removed framer-motion (not compatible with RN)
 * - Replaced motion.div with View
 * - Added platform-specific shadow/elevation
 * - Removed hover states (not applicable in touch interfaces)
 * - Replaced 'hoverable' with onPress for touch interaction
 */

interface GlassCardProps extends ViewProps {
  variant?: 'default' | 'glow' | 'solid' | 'interactive';
  glowColor?: 'primary' | 'success' | 'warning' | 'destructive';
  noPadding?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}

export const GlassCard = React.forwardRef<React.ElementRef<typeof View>, GlassCardProps>(
  ({ className, variant = 'default', glowColor, noPadding, onPress, children, style, ...props }, ref) => {
    const baseClasses = 'rounded-2xl border border-border/50 bg-card/80';
    
    const variantClasses = {
      default: 'bg-card/80 backdrop-blur-lg',
      glow: cn(
        'bg-card/80 backdrop-blur-lg',
        glowColor === 'primary' && 'border-primary/40',
        glowColor === 'success' && 'border-success/40',
        glowColor === 'warning' && 'border-warning/40',
        glowColor === 'destructive' && 'border-destructive/40'
      ),
      solid: 'bg-card border-border',
      interactive: 'bg-card/80 backdrop-blur-lg active:opacity-90',
    };

    const shadowStyle = {
      // iOS shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      // Android elevation
      elevation: 3,
    };

    const content = (
      <View
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          !noPadding && 'p-4',
          className
        )}
        style={[shadowStyle, style]}
        {...props}
      >
        {children}
      </View>
    );

    if (onPress) {
      return (
        <Pressable onPress={onPress} className={({ pressed }) => pressed ? 'opacity-90' : ''}>
          {content}
        </Pressable>
      );
    }

    return content;
  }
);

GlassCard.displayName = 'GlassCard';
