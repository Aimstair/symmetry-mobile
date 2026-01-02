import * as React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { cn } from '@/lib/utils';

/**
 * CircularProgress Component - React Native Implementation
 * 
 * Migration Notes:
 * - Uses react-native-svg for circular progress
 * - Replaced HTML divs with View
 * - Replaced span elements with Text
 * - SVG animation handled via strokeDashoffset
 * - Maintains exact same API as web version
 */

interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  showValue?: boolean;
  className?: string;
}

export function CircularProgress({
  value,
  max,
  size = 80,
  strokeWidth = 6,
  label,
  sublabel,
  color = 'primary',
  showValue = true,
  className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / max) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorMap = {
    primary: '#31D5E3', // hsl(187, 85%, 53%)
    success: '#4ADE80', // hsl(142, 69%, 58%)
    warning: '#F59E0B', // hsl(38, 92%, 50%)
    destructive: '#EF4444', // hsl(0, 84%, 60%)
  };

  const mutedColor = '#3F3F46'; // hsl(240, 5%, 16%)

  return (
    <View className={cn('flex flex-col items-center', className)}>
      <View style={{ width: size, height: size }} className="relative">
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={mutedColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorMap[color]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>
        {showValue && (
          <View className="absolute inset-0 flex flex-col items-center justify-center">
            <Text className="text-lg font-bold text-foreground">
              {Math.round(value)}
            </Text>
            {sublabel && (
              <Text className="text-[10px] text-muted-foreground">{sublabel}</Text>
            )}
          </View>
        )}
      </View>
      {label && (
        <Text className="mt-2 text-xs font-medium text-muted-foreground">
          {label}
        </Text>
      )}
    </View>
  );
}
