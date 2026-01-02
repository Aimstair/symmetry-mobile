import * as React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { GlassCard } from './GlassCard';
import type { LucideIcon } from 'lucide-react-native';

/**
 * StatCard Component - React Native Implementation
 * 
 * Migration Notes:
 * - Replaced div with View
 * - Replaced span with Text
 * - Icon prop type changed to lucide-react-native
 * - Maintains exact same props API
 */

interface StatCardProps extends Omit<ViewProps, 'children'> {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  color = 'default',
  className,
  ...props
}: StatCardProps) {
  const colorClasses = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  const iconColorMap = {
    default: '#FAFAFA', // hsl(0, 0%, 98%)
    primary: '#31D5E3', // hsl(187, 85%, 53%)
    success: '#4ADE80', // hsl(142, 69%, 58%)
    warning: '#F59E0B', // hsl(38, 92%, 50%)
    destructive: '#EF4444', // hsl(0, 84%, 60%)
  };

  return (
    <GlassCard className={cn('min-w-[140px]', className)} {...props}>
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </Text>
        {Icon && (
          <Icon size={16} color={iconColorMap[color]} />
        )}
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text className={cn('text-2xl font-bold', colorClasses[color])}>
          {value}
        </Text>
        {unit && (
          <Text className="text-sm text-muted-foreground">{unit}</Text>
        )}
      </View>
      {trend && (
        <View className="flex-row items-center gap-1 mt-1">
          <Text
            className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </Text>
          <Text className="text-xs text-muted-foreground">vs last week</Text>
        </View>
      )}
    </GlassCard>
  );
}
