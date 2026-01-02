import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Modal } from './modal';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined);

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      {children}
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectTrigger({ children, className }: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');

  return (
    <Pressable
      onPress={() => context.setOpen(true)}
      className={cn(
        'flex-row items-center justify-between h-10 px-3 py-2 bg-background border border-border rounded-md',
        className
      )}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {children}
      <ChevronDown size={16} color="#71717A" />
    </Pressable>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  // Find the selected item's label
  const selectedLabel = context.value || placeholder;

  return (
    <Text className="text-foreground text-sm flex-1">
      {selectedLabel}
    </Text>
  );
}

interface SelectContentProps {
  children: React.ReactNode;
}

export function SelectContent({ children }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectContent must be used within Select');

  return (
    <Modal open={context.open} onOpenChange={context.setOpen}>
      <View className="bg-card border border-border rounded-xl w-full max-w-sm overflow-hidden">
        <ScrollView className="max-h-80">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function SelectItem({ value, children }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');

  const isSelected = context.value === value;

  return (
    <Pressable
      onPress={() => {
        context.onValueChange(value);
        context.setOpen(false);
      }}
      className={cn(
        'px-4 py-3 border-b border-border',
        isSelected && 'bg-primary/10'
      )}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text className={cn(
        'text-sm',
        isSelected ? 'text-primary font-medium' : 'text-foreground'
      )}>
        {children}
      </Text>
    </Pressable>
  );
}
