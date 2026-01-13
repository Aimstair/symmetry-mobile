/**
 * EmptyState Component
 * 
 * A reusable empty state component for screens with no data.
 * Provides visual feedback and a call-to-action button.
 */

import { View, Text } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react-native';

interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

interface EmptyStateProps {
  /** Title text shown prominently */
  title: string;
  /** Description text shown below the title */
  description: string;
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Optional primary action button */
  action?: EmptyStateAction;
  /** Optional secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Icon color (defaults to primary cyan) */
  iconColor?: string;
  /** Whether to use glow variant for the card */
  glow?: boolean;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  secondaryAction,
  iconColor = '#31D5E3',
  glow = true,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <GlassCard 
        variant={glow ? 'glow' : 'default'} 
        glowColor="primary" 
        className="items-center p-8 w-full max-w-sm"
      >
        {/* Icon Container */}
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-5">
          <Icon size={40} color={iconColor} />
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-foreground text-center mb-2">
          {title}
        </Text>

        {/* Description */}
        <Text className="text-muted-foreground text-center text-sm leading-5 mb-6">
          {description}
        </Text>

        {/* Action Buttons */}
        {action && (
          <Button
            variant="default"
            onPress={action.onPress}
            className="w-full"
          >
            <Text className="text-primary-foreground font-semibold">
              {action.label}
            </Text>
          </Button>
        )}

        {secondaryAction && (
          <Button
            variant="outline"
            onPress={secondaryAction.onPress}
            className="w-full mt-3"
          >
            <Text className="text-foreground font-medium">
              {secondaryAction.label}
            </Text>
          </Button>
        )}
      </GlassCard>
    </View>
  );
}

export default EmptyState;
