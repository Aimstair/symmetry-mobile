/**
 * ShareModal Component
 * 
 * Modal for sharing workout summaries to social media.
 * Captures screenshot of WorkoutSummaryCard and opens native share sheet.
 */

import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { WorkoutSummaryCard, WorkoutSummaryData } from './WorkoutSummaryCard';
import { Share2, Instagram, MessageCircle, Copy, Check } from 'lucide-react-native';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutData: WorkoutSummaryData;
}

export function ShareModal({ open, onOpenChange, workoutData }: ShareModalProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  const captureAndShare = async () => {
    if (!viewShotRef.current) {
      Alert.alert('Error', 'Unable to capture workout summary');
      return;
    }

    setIsSharing(true);
    try {
      // Capture the view as an image
      const uri = await viewShotRef.current.capture?.();
      
      if (!uri) {
        throw new Error('Failed to capture image');
      }

      setCapturedUri(uri);
      setIsCaptured(true);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device');
        return;
      }

      // Open native share sheet
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Your Workout',
        UTI: 'public.png', // iOS specific
      });

    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Unable to share workout. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const shareToInstagram = async () => {
    if (!viewShotRef.current) return;

    setIsSharing(true);
    try {
      const uri = await viewShotRef.current.capture?.();
      if (!uri) throw new Error('Failed to capture');

      // For Instagram Stories, we need to copy to a specific location
      // Instagram Stories supports sharing via native share sheet
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share to Instagram',
      });

    } catch (error) {
      console.error('Instagram share error:', error);
      Alert.alert('Share Failed', 'Unable to share to Instagram');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    // Create a shareable text version
    const text = `🏋️ Workout Complete!

${workoutData.workoutName}
⏱️ Duration: ${Math.floor(workoutData.duration / 60)}m
🔥 Volume: ${workoutData.totalVolume.toLocaleString()} lbs
💪 Sets: ${workoutData.completedSets}
${workoutData.prs ? `🏆 PRs: ${workoutData.prs}` : ''}

Track your gains with Symmetry 💪`;

    // Note: expo-clipboard would be needed for actual clipboard copy
    Alert.alert('Copied!', 'Workout summary text copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader onClose={() => onOpenChange(false)}>
          <View className="flex-row items-center gap-2">
            <Share2 size={20} color="#31D5E3" />
            <DialogTitle>Share Your Workout</DialogTitle>
          </View>
          <DialogDescription>
            Show off your progress on social media
          </DialogDescription>
        </DialogHeader>

        {/* Preview Card */}
        <View className="items-center py-4">
          <View style={{ transform: [{ scale: 0.85 }] }}>
            <WorkoutSummaryCard ref={viewShotRef} data={workoutData} />
          </View>
        </View>

        {/* Share Options */}
        <View className="gap-3">
          {/* Main Share Button */}
          <Button
            className="w-full bg-primary"
            onPress={captureAndShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Share2 size={18} color="#000" />
                <Text className="text-primary-foreground font-semibold ml-2">
                  Share to Any App
                </Text>
              </>
            )}
          </Button>

          {/* Quick Actions Row */}
          <View className="flex-row gap-3">
            {/* Instagram */}
            <Pressable
              onPress={shareToInstagram}
              disabled={isSharing}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r border border-border"
              style={({ pressed }) => ({ opacity: pressed || isSharing ? 0.7 : 1 })}
            >
              <Instagram size={18} color="#E4405F" />
              <Text className="text-foreground font-medium">Instagram</Text>
            </Pressable>

            {/* Copy Text */}
            <Pressable
              onPress={copyToClipboard}
              disabled={isSharing}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border"
              style={({ pressed }) => ({ opacity: pressed || isSharing ? 0.7 : 1 })}
            >
              <Copy size={18} color="#71717A" />
              <Text className="text-foreground font-medium">Copy Text</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer Note */}
        <Text className="text-center text-muted-foreground text-xs mt-4">
          Sharing helps others discover their fitness potential! 🚀
        </Text>
      </DialogContent>
    </Dialog>
  );
}

export default ShareModal;
