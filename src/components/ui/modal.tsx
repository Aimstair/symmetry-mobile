import React from 'react';
import { View, Text, Modal as RNModal, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/utils';


interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Modal({ open, onOpenChange, children }: ModalProps) {
  if (!open) return null;

  const keyboardBehavior: 'padding' | 'height' | undefined =
    Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined;
  
  return (
    <RNModal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop - tapping this closes the modal */}
        <TouchableOpacity 
          activeOpacity={1}
          style={styles.backdrop}
          onPress={() => onOpenChange(false)}
        />
        
        {/* Content Container - sits above backdrop */}
        <View style={styles.contentPosition}>
          <KeyboardAvoidingView 
            behavior={keyboardBehavior}
            enabled
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            style={styles.keyboardView}
          >
            <View style={styles.contentWrapper}>
              <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled={true}
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {children}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  contentPosition: {
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 16,
    maxHeight: '90%',
    zIndex: 2, // Ensure content is above backdrop
    justifyContent: 'center', // Center content within the position wrapper
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    maxHeight: '90%',
  },
  contentWrapper: {
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
});

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalContent({ children, className }: ModalContentProps) {
  return (
    <View className={cn('w-full', className)}>
      {children}
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
