import { showAppAlert } from '@/store/useAlertStore';
/**
 * ShareModal Component
 *
 * Modal for sharing workout summaries.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, Pressable, ActivityIndicator, Image, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { WorkoutSummaryData } from './WorkoutSummaryCard';
import { Share2, Copy, Download, Camera } from 'lucide-react-native';
import { useAppStore } from '@/store/useAppStore';
import * as Linking from 'expo-linking';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutData: WorkoutSummaryData;
}

type StoryVariant = 'story';
type ToastKind = 'success' | 'error' | 'info';

const STORY_VARIANT: StoryVariant = 'story';

const getOverlayDimensions = () => ({ width: 270, height: 480 });

const getCountryLabel = () => {
  const dateTimeOptions = Intl.DateTimeFormat().resolvedOptions();
  const locale =
    dateTimeOptions.locale ||
    (typeof navigator !== 'undefined' ? navigator.language : undefined) ||
    '';
  const timeZone = dateTimeOptions.timeZone || '';

  const localeParts = locale.split(/[-_]/);
  const localeRegion =
    localeParts.length > 1 && /^[A-Za-z]{2}$/.test(localeParts[localeParts.length - 1])
      ? localeParts[localeParts.length - 1].toUpperCase()
      : null;

  const timezoneToRegion: Record<string, string> = {
    'Asia/Manila': 'PH',
  };

  const timezoneRegion = timeZone ? timezoneToRegion[timeZone] : undefined;
  const regionCode =
    localeRegion === 'US' && timezoneRegion
      ? timezoneRegion
      : localeRegion || timezoneRegion || null;

  if (!regionCode) return 'your country';

  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(regionCode) || regionCode;
  }

  return regionCode;
};

const extractNumericValue = (value?: string) => {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const formatShareDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
};

function PhotoOverlayContent({
  photoUri,
  workoutData,
  unit,
}: {
  photoUri: string | null;
  workoutData: WorkoutSummaryData;
  unit: 'lbs' | 'kg';
}) {
  const { width, height } = getOverlayDimensions();
  const countryLabel = getCountryLabel();
  const durationLabel = formatShareDuration(workoutData.duration);
  const totalLabel = `${workoutData.totalVolume.toLocaleString()} ${unit}`;
  const effectiveRank =
    typeof workoutData.rank === 'number' && workoutData.rank > 0
      ? Math.floor(workoutData.rank)
      : 1;
  const rankLabel = `#${effectiveRank} strongest in ${countryLabel} today`;
  const exercisesDoneCount =
    (workoutData.reportItems && workoutData.reportItems.length > 0
      ? workoutData.reportItems.length
      : extractNumericValue(workoutData.exerciseSummary)) || workoutData.completedSets;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#030712',
      }}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#0B1320', '#122737', '#0D1A24']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <LinearGradient
        colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0.82)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.overlayRoot, styles.overlayRootStory]}>
        {/* <View style={[styles.overlayHeader, styles.overlayHeaderStory]}>
          <Text style={[styles.overlayTitle, styles.overlayTitleStory]}>
            Workout Complete
          </Text>
          <Text
            style={[styles.overlaySubtitle, styles.overlaySubtitleStory]}
            numberOfLines={2}
          >
            {workoutData.workoutName}
          </Text>
        </View> */}

        <View className="pt-12" style={[styles.overlayMetrics, styles.overlayMetricsStory]}>
          <View style={styles.overlayMetricStack}>
            <Text style={styles.overlayMetricValue} numberOfLines={1}>
              {totalLabel}
            </Text>
            <Text style={styles.overlayMetricLabel}>Total lifted</Text>
          </View>
          <View style={styles.overlayMetricStack}>
            <Text style={styles.overlayMetricValue} numberOfLines={1}>
              {durationLabel}
            </Text>
            <Text style={styles.overlayMetricLabel}>Duration</Text>
          </View>
          <View style={styles.overlayMetricStack}>
            <Text style={styles.overlayMetricValue} numberOfLines={2}>
              {exercisesDoneCount}
            </Text>
            <Text style={styles.overlayMetricLabel}>Exercises</Text>
          </View>
        </View>
        
        <View>
          <Text style={styles.overlayRanking}>{rankLabel}</Text>
            <Text style={[styles.overlaySignature, styles.overlaySignatureStory]}>Symmetry</Text>
        </View>
      </View>
    </View>
  );
}

export function ShareModal({ open, onOpenChange, workoutData }: ShareModalProps) {
  const unit = useAppStore((s) => s.settings.unit);
  const overlayViewShotRef = useRef<ViewShot>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isSavingToGallery, setIsSavingToGallery] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedVariant, setCapturedVariant] = useState<StoryVariant | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [overlayPhotoUri, setOverlayPhotoUri] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<ToastKind>('info');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewConfig = {
    frameWidth: 160,
    frameHeight: 284,
    renderWidth: 270,
  };

  const previewScale = previewConfig.frameWidth / previewConfig.renderWidth;
  const isMediaActionBusy = isSharing || isSavingToGallery;

  const showStatusToast = (message: string, kind: ToastKind = 'info') => {
    setToastKind(kind);
    setToastMessage(message);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  };

  const showPermissionBlockedAlert = (title: string, message: string) => {
    showAppAlert(title, message, [
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings().catch(() => {
            showStatusToast('Unable to open Settings.', 'error');
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  useEffect(() => {
    setCapturedUri(null);
    setCapturedVariant(null);
    setCapturedPhotoUri(null);
  }, [overlayPhotoUri, workoutData]);

  useEffect(() => {
    if (!open) {
      setOverlayPhotoUri(null);
      setIsSharing(false);
      setIsSavingToGallery(false);
      setToastMessage(null);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Native share can background the app and occasionally miss completion callbacks.
        // Reset the share lock on foreground so controls never remain stuck.
        setIsSharing(false);
      }
    });

    return () => subscription.remove();
  }, []);

  const takePhotoForOverlay = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          showPermissionBlockedAlert(
            'Camera Permission Blocked',
            'Camera access is blocked. Enable it in Settings to take a new photo.'
          );
          return;
        }

        showStatusToast('Enable camera access to create a photo overlay story.', 'error');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.95,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setOverlayPhotoUri(result.assets[0].uri);
    } catch (error) {
      console.error('Camera capture error:', error);
      showStatusToast('Unable to take a photo right now. Please try again.', 'error');
    }
  };

  const pickPhotoFromLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          showPermissionBlockedAlert(
            'Photo Permission Blocked',
            'Photo library access is blocked. Enable it in Settings to choose a photo.'
          );
          return;
        }

        showStatusToast('Enable photo library access to choose an image.', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.95,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setOverlayPhotoUri(result.assets[0].uri);
    } catch (error) {
      console.error('Gallery picker error:', error);
      showStatusToast('Unable to pick a photo right now. Please try again.', 'error');
    }
  };

  const openAddPhotoOptions = () => {
    showAppAlert('Add Photo', 'Choose where to get your photo from.', [
      { text: 'Take Photo', onPress: takePhotoForOverlay },
      { text: 'Choose from Gallery', onPress: pickPhotoFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const ensureCapturedUri = async (): Promise<string> => {
    if (!overlayPhotoUri) {
      throw new Error('Add a photo first to create the overlay.');
    }

    const activeRef = overlayViewShotRef.current;

    if (!activeRef) {
      throw new Error('Unable to capture workout summary');
    }

    if (
      capturedUri &&
      capturedVariant === STORY_VARIANT &&
      capturedPhotoUri === overlayPhotoUri
    ) {
      const info = await FileSystem.getInfoAsync(capturedUri);
      if (info.exists) {
        return capturedUri;
      }
    }

    const uri = await activeRef.capture?.();
    if (!uri) {
      throw new Error('Failed to capture image');
    }

    setCapturedUri(uri);
    setCapturedVariant(STORY_VARIANT);
    setCapturedPhotoUri(overlayPhotoUri);
    return uri;
  };

  const captureAndShare = async () => {
    if (!overlayPhotoUri) {
      showStatusToast('Add a photo first to create the overlay.', 'info');
      return;
    }

    setIsSharing(true);
    try {
      const uri = await ensureCapturedUri();

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showStatusToast('Sharing is not available on this device.', 'error');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Your Workout',
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Share error:', error);
      showStatusToast(error instanceof Error ? error.message : 'Unable to share workout. Please try again.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const saveToGallery = async () => {
    if (!overlayPhotoUri) {
      showStatusToast('Add a photo first to create the overlay.', 'info');
      return;
    }

    setIsSavingToGallery(true);

    try {
      const currentPermission = await MediaLibrary.getPermissionsAsync();

      if (currentPermission.status === 'denied' && !currentPermission.canAskAgain) {
        showPermissionBlockedAlert(
          'Permission Blocked',
          'Photo access is blocked. Enable it in Settings to save images.'
        );
        return;
      }

      let granted = currentPermission.granted;
      if (!granted) {
        const requested = await MediaLibrary.requestPermissionsAsync();
        granted = requested.granted;
      }

      if (!granted) {
        showStatusToast('Allow photo access to save your workout summary to the gallery.', 'error');
        return;
      }

      const uri = await ensureCapturedUri();
      await MediaLibrary.saveToLibraryAsync(uri);
      showStatusToast('Saved to gallery', 'success');
    } catch (error) {
      console.error('Gallery save error:', error);
      showStatusToast(error instanceof Error ? error.message : 'Unable to save to gallery. Please try again.', 'error');
    } finally {
      setIsSavingToGallery(false);
    }
  };

  const copyToClipboard = async () => {
    const effectiveRank =
      typeof workoutData.rank === 'number' && workoutData.rank > 0
        ? Math.floor(workoutData.rank)
        : 1;

    const detailLines = [
      `Duration: ${formatShareDuration(workoutData.duration)}`,
      `Volume: ${workoutData.totalVolume.toLocaleString()} ${unit}`,
      `Sets: ${workoutData.completedSets}`,
      workoutData.exerciseSummary ? `Exercises: ${workoutData.exerciseSummary}` : null,
      typeof workoutData.prs === 'number' && workoutData.prs > 0 ? `PRs: ${workoutData.prs}` : null,
      typeof workoutData.streakDays === 'number' && workoutData.streakDays > 0
        ? `Streak: ${workoutData.streakDays} day${workoutData.streakDays === 1 ? '' : 's'}`
        : null,
      typeof workoutData.symmetryScore === 'number'
        ? `Symmetry Score: ${workoutData.symmetryScore.toFixed(1)}`
        : null,
      `Rank: #${effectiveRank}`,
      ...(workoutData.reportItems && workoutData.reportItems.length > 0
        ? ['', 'Detailed Report:', ...workoutData.reportItems.slice(0, 8).map((item) => `- ${item.label}: ${item.value}`)]
        : []),
    ].filter(Boolean) as string[];

    const text = ['Workout Complete!', '', workoutData.workoutName, ...detailLines, '', 'Track your gains with Symmetry.'].join(
      '\n'
    );

    try {
      const clipboardModule = require('expo-clipboard') as typeof import('expo-clipboard');
      await clipboardModule.setStringAsync(text);
      showStatusToast('Workout summary text copied to clipboard', 'success');
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      showStatusToast('Clipboard is unavailable in this build. Rebuild the app to enable copy text.', 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader onClose={() => onOpenChange(false)}>
          <View className="flex-row items-center gap-2">
            <Share2 size={20} color="#31D5E3" />
            <DialogTitle>Share Your Workout</DialogTitle>
          </View>
          <DialogDescription>Add a photo and share.</DialogDescription>
        </DialogHeader>

        <Text className="text-center text-xs text-muted-foreground mb-3">IG Story 9:16</Text>

        <View pointerEvents="none" style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0 }}>
          <ViewShot ref={overlayViewShotRef} options={{ format: 'png', quality: 1 }}>
            <PhotoOverlayContent photoUri={overlayPhotoUri} workoutData={workoutData} unit={unit} />
          </ViewShot>
        </View>

        <View className="items-center mb-3">
          <View
            style={{
              width: previewConfig.frameWidth,
              height: previewConfig.frameHeight,
              borderRadius: 20,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(113, 113, 122, 0.35)',
              backgroundColor: 'rgba(9, 9, 11, 0.45)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View style={{ transform: [{ scale: previewScale }] }}>
              <PhotoOverlayContent photoUri={overlayPhotoUri} workoutData={workoutData} unit={unit} />
            </View>
          </View>
        </View>

        <Pressable
          onPress={openAddPhotoOptions}
          disabled={isMediaActionBusy}
          className="w-full flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-border mb-2"
          style={({ pressed }) => ({ opacity: pressed || isMediaActionBusy ? 0.7 : 1 })}
        >
          <Camera size={18} color="#31D5E3" />
          <Text className="text-foreground font-medium">Add Photo</Text>
        </Pressable>

        <View className="gap-2">
          <View className="flex-row gap-2">
            <Button className="flex-1 bg-primary h-10 rounded-xl" onPress={captureAndShare} disabled={isSharing}>
              {isSharing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Share2 size={18} color="#000" />
                  <Text className="text-primary-foreground font-semibold ml-2">Share</Text>
                </>
              )}
            </Button>

            <Pressable
              onPress={copyToClipboard}
              disabled={isSavingToGallery}
              className="flex-1 flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-border"
              style={({ pressed }) => ({ opacity: pressed || isSavingToGallery ? 0.7 : 1 })}
            >
              <Copy size={18} color="#71717A" />
              <Text className="text-foreground font-medium">Copy Text</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={saveToGallery}
            disabled={isMediaActionBusy}
            className="w-full flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-border"
            style={({ pressed }) => ({ opacity: pressed || isMediaActionBusy ? 0.7 : 1 })}
          >
            <Download size={18} color="#31D5E3" />
            <Text className="text-foreground font-medium">{isSavingToGallery ? 'Saving...' : 'Save to Gallery'}</Text>
          </Pressable>
        </View>

        <Text className="text-center text-muted-foreground text-xs mt-3">
          Preview is optimized to keep controls visible.
        </Text>

        {toastMessage ? (
          <View
            pointerEvents="none"
            style={[
              styles.toast,
              toastKind === 'success' && styles.toastSuccess,
              toastKind === 'error' && styles.toastError,
              toastKind === 'info' && styles.toastInfo,
            ]}
          >
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'space-between',
  },
  overlayRootStory: {
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  overlayHeader: {
    alignItems: 'center',
  },
  overlayHeaderStory: {
    paddingHorizontal: 4,
  },
  overlayTitle: {
    color: '#E5E7EB',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  overlayTitleStory: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.35,
  },
  overlaySubtitle: {
    color: '#C7D2FE',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '96%',
  },
  overlaySubtitleStory: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    maxWidth: '92%',
  },
  overlayMetrics: {
    gap: 10,
  },
  overlayMetricsStory: {
    gap: 12,
  },
  overlayMetricStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayMetricLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  overlayMetricValue: {
    color: '#F8FAFC',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  overlaySignature: {
    color: '#31D5E3',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  overlayRanking: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  overlaySignatureStory: {
    fontSize: 28,
    paddingBottom: 2,
  },
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.95)',
    borderColor: 'rgba(134, 239, 172, 0.5)',
  },
  toastError: {
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    borderColor: 'rgba(252, 165, 165, 0.5)',
  },
  toastInfo: {
    backgroundColor: 'rgba(30, 64, 175, 0.95)',
    borderColor: 'rgba(147, 197, 253, 0.5)',
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default ShareModal;
