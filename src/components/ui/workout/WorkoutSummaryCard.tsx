/**
 * WorkoutSummaryCard Component
 *
 * A social-first workout card optimized for screenshot sharing.
 * Supports detailed report rows with feed and story variants.
 * Wrapped in ViewShot for screenshot capture.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { Flame, Waves } from 'lucide-react-native';
import { formatWorkoutDuration } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

export interface WorkoutSummaryData {
  workoutName: string;
  duration: number;
  totalVolume: number;
  completedSets: number;
  prs?: number;
  rank?: number;
  date?: Date;
  streakDays?: number;
  symmetryScore?: number;
  reportItems?: Array<{ label: string; value: string }>;
  exerciseSummary?: string;
}

interface WorkoutSummaryCardProps {
  data: WorkoutSummaryData;
  variant?: 'feed' | 'story';
}

export const WorkoutSummaryCard = React.forwardRef(
  ({ data, variant = 'feed' }: WorkoutSummaryCardProps, ref: React.ForwardedRef<ViewShot>) => {
    const unit = useAppStore((s) => s.settings.unit);
    const isStoryVariant = variant === 'story';
    const hasStreak = typeof data.streakDays === 'number' && data.streakDays > 0;
    const hasSymmetry = typeof data.symmetryScore === 'number' && !Number.isNaN(data.symmetryScore);

    const formatVolume = (volume: number) => {
      if (volume >= 10000) {
        return `${(volume / 1000).toFixed(1)}k`;
      }
      return volume.toLocaleString();
    };

    const formatDate = (date?: Date) => {
      if (!date) {
        return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const reportRows =
      data.reportItems && data.reportItems.length > 0
        ? data.reportItems.slice(0, isStoryVariant ? 8 : 7)
        : [
            {
              label: 'Completed Sets',
              value: `${data.completedSets}`,
            },
            {
              label: 'Total Volume',
              value: `${formatVolume(data.totalVolume)} ${unit}`,
            },
            {
              label: 'Session Focus',
              value: data.exerciseSummary || 'Strength Session',
            },
          ];

    return (
      <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
        <View style={[styles.container, isStoryVariant && styles.storyContainer]}>
          <LinearGradient
            colors={['#071018', '#0D1C25', '#122F34']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.topGlow} />
            <View style={styles.bottomGlow} />

            <View style={styles.headerRow}>
              <Text style={styles.brand}>SYMMETRY</Text>
              <Text style={styles.dateText}>{formatDate(data.date)} workout</Text>
            </View>

            <Text style={[styles.workoutTitle, isStoryVariant && styles.storyWorkoutTitle]} numberOfLines={2}>
              {data.workoutName}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatVolume(data.totalVolume)} {unit}</Text>
                <Text style={styles.statLabel}>Total lifted</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatWorkoutDuration(data.duration)}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
            </View>

            <Text style={styles.reportTitle}>Detailed Report</Text>

            <View style={[styles.reportList, isStoryVariant && styles.storyReportList]}>
              {reportRows.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.reportRow}>
                  <Text style={styles.reportLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.reportValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.metaFooter}>
              {data.exerciseSummary ? <Text style={styles.exerciseSummary}>{data.exerciseSummary}</Text> : null}

              {(hasStreak || hasSymmetry) && (
                <View style={styles.metaChipsRow}>
                  {hasStreak && (
                    <View style={styles.metaChip}>
                      <Flame size={12} color="#F59E0B" />
                      <Text style={styles.metaChipText}>
                        {data.streakDays} day{data.streakDays === 1 ? '' : 's'} streak
                      </Text>
                    </View>
                  )}
                  {hasSymmetry && (
                    <View style={styles.metaChip}>
                      <Waves size={12} color="#4ADE80" />
                      <Text style={styles.metaChipText}>Symmetry {data.symmetryScore?.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </LinearGradient>
        </View>
      </ViewShot>
    );
  }
);

WorkoutSummaryCard.displayName = 'WorkoutSummaryCard';

const styles = StyleSheet.create({
  container: {
    width: 340,
    aspectRatio: 1,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.28)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  storyContainer: {
    width: 270,
    aspectRatio: 9 / 16,
    borderRadius: 28,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  topGlow: {
    position: 'absolute',
    top: -66,
    right: -36,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -58,
    left: -28,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brand: {
    color: '#A5F3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  dateText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  workoutTitle: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  storyWorkoutTitle: {
    fontSize: 23,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    borderRadius: 14,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  statLabel: {
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  reportTitle: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  reportList: {
    gap: 8,
    marginBottom: 12,
  },
  storyReportList: {
    gap: 7,
    marginBottom: 14,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(2, 8, 23, 0.58)',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  reportLabel: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  reportValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '47%',
    textAlign: 'right',
  },
  metaFooter: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.16)',
    paddingTop: 10,
    gap: 8,
  },
  exerciseSummary: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.2)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  metaChipText: {
    marginLeft: 5,
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default WorkoutSummaryCard;
