import React from 'react';
import { View, Text, Modal as RNModal, Pressable, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Modal({ open, onOpenChange, children }: ModalProps) {
  return (
    <RNModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <View className="flex-1 bg-black/80 items-center justify-center px-4">
        {children}
      </View>
    </RNModal>
  );
}

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalContent({ children, className }: ModalContentProps) {
  return (
    <View className={cn(
      'bg-card border border-border rounded-xl w-full max-w-lg p-6',
      className
    )}>
      <ScrollView className="max-h-[80vh]" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export function ModalHeader({ children, onClose }: ModalHeaderProps) {
  return (
    <View className="mb-4">
      {onClose && (
        <Pressable 
          onPress={onClose}
          className="absolute right-0 top-0 z-10"
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <X size={20} color="#71717A" />
        </Pressable>
      )}
      {children}
    </View>
  );
}

interface ModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalTitle({ children, className }: ModalTitleProps) {
  return (
    <Text className={cn('text-xl font-bold text-foreground', className)}>
      {children}
    </Text>
  );
}

interface ModalDescriptionProps {
  children: React.ReactNode;
}

export function ModalDescription({ children }: ModalDescriptionProps) {
  return (
    <Text className="text-sm text-muted-foreground mt-1">
      {children}
    </Text>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <View className="flex-row gap-2 mt-6">
      {children}
    </View>
  );
}

// Aliases for compatibility with web Dialog API
export const Dialog = Modal;
export const DialogContent = ModalContent;
export const DialogHeader = ModalHeader;
export const DialogTitle = ModalTitle;
export const DialogDescription = ModalDescription;
export const DialogFooter = ModalFooter;
