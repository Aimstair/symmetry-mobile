/**
 * WorkoutSummaryCard Component
 * 
 * A visually appealing card designed for social sharing.
 * Displays workout stats with gradient background and branding.
 * Wrapped in ViewShot for screenshot capture.
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { Trophy, Flame, Dumbbell, Timer, TrendingUp } from 'lucide-react-native';

export interface WorkoutSummaryData {
  workoutName: string;
  duration: number; // in seconds
  totalVolume: number;
  completedSets: number;
  prs?: number;
  date?: Date;
}

interface WorkoutSummaryCardProps {
  data: WorkoutSummaryData;
}

export const WorkoutSummaryCard = forwardRef<ViewShot, WorkoutSummaryCardProps>(
  ({ data }, ref) => {
    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) {
        return `${hrs}h ${mins % 60}m`;
      }
      return `${mins}m`;
    };

    const formatVolume = (volume: number) => {
      if (volume >= 10000) {
        return `${(volume / 1000).toFixed(1)}k`;
      }
      return volume.toLocaleString();
    };

    const formatDate = (date?: Date) => {
      if (!date) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#0A0A0F', '#1A1A2E', '#16213E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Header with Logo */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>SYMMETRY</Text>
              </View>
              <Text style={styles.dateText}>{formatDate(data.date)}</Text>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
              {/* Trophy Icon */}
              <View style={styles.trophyContainer}>
                <Trophy size={48} color="#31D5E3" />
              </View>

              {/* Title */}
              <Text style={styles.title}>WORKOUT COMPLETE</Text>
              <Text style={styles.workoutName}>{data.workoutName}</Text>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                {/* Duration */}
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <Timer size={20} color="#31D5E3" />
                  </View>
                  <Text style={styles.statValue}>{formatDuration(data.duration)}</Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>

                {/* Volume */}
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <Flame size={20} color="#F59E0B" />
                  </View>
                  <Text style={styles.statValue}>{formatVolume(data.totalVolume)}</Text>
                  <Text style={styles.statLabel}>Volume (lbs)</Text>
                </View>

                {/* Sets */}
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <Dumbbell size={20} color="#22C55E" />
                  </View>
                  <Text style={styles.statValue}>{data.completedSets}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>

                {/* PRs (if any) */}
                {data.prs && data.prs > 0 && (
                  <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                      <TrendingUp size={20} color="#EC4899" />
                    </View>
                    <Text style={styles.statValue}>{data.prs}</Text>
                    <Text style={styles.statLabel}>PRs</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Footer Branding */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Track your gains with Symmetry 💪</Text>
            </View>

            {/* Decorative Elements */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />
          </LinearGradient>
        </View>
      </ViewShot>
    );
  }
);

WorkoutSummaryCard.displayName = 'WorkoutSummaryCard';

const styles = StyleSheet.create({
  container: {
    width: 350,
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    borderWidth: 1,
    borderColor: 'rgba(49, 213, 227, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  logoText: {
    color: '#31D5E3',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 2,
  },
  dateText: {
    color: '#71717A',
    fontSize: 12,
  },
  content: {
    alignItems: 'center',
  },
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(49, 213, 227, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  workoutName: {
    color: '#A1A1AA',
    fontSize: 14,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    color: '#71717A',
    fontSize: 12,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(49, 213, 227, 0.05)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
});

export default WorkoutSummaryCard;
