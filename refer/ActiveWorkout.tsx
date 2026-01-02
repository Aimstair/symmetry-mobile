import { useState, useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  ChevronLeft, 
  Timer, 
  Check, 
  Plus, 
  MoreVertical,
  Calculator,
  StickyNote,
  SkipForward,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExerciseDetailSheet } from '@/components/workout/ExerciseDetailSheet';
import { ExerciseHistorySheet } from '@/components/workout/ExerciseHistorySheet';

interface SetData {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
  isWarmup: boolean;
  tags: string[];
  prevWeight?: number;
  prevReps?: number;
}

interface ExerciseData {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  sets: SetData[];
  supersetId?: string;
  notes?: string;
}

// Mock exercise data
// Mock exercise data (weights in kg as default)
const initialExercises: ExerciseData[] = [
  {
    id: '1',
    name: 'Barbell Bench Press',
    targetSets: 4,
    targetReps: '6-8',
    restSeconds: 180,
    sets: [
      { id: 1, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 8 },
      { id: 2, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 7 },
      { id: 3, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 6 },
      { id: 4, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 6 },
    ],
  },
  {
    id: '2',
    name: 'Incline Dumbbell Press',
    targetSets: 4,
    targetReps: '8-12',
    restSeconds: 120,
    supersetId: 'ss1',
    sets: [
      { id: 1, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 30, prevReps: 10 },
      { id: 2, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 30, prevReps: 10 },
      { id: 3, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 30, prevReps: 9 },
      { id: 4, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 27.5, prevReps: 8 },
    ],
  },
  {
    id: '3',
    name: 'Cable Flyes',
    targetSets: 3,
    targetReps: '12-15',
    restSeconds: 90,
    supersetId: 'ss1',
    sets: [
      { id: 1, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 12.5, prevReps: 15 },
      { id: 2, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 12.5, prevReps: 14 },
      { id: 3, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 12.5, prevReps: 12 },
    ],
  },
];

export default function ActiveWorkout() {
  const navigate = useNavigate();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [exercises, setExercises] = useState<ExerciseData[]>(initialExercises);
  const [warmupMode, setWarmupMode] = useState(false);
  const [deloadMode, setDeloadMode] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [targetRestTime, setTargetRestTime] = useState(90);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [calcWeight, setCalcWeight] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseData | null>(null);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rest timer
  useEffect(() => {
    if (showRestTimer && restTime < targetRestTime) {
      const interval = setInterval(() => {
        setRestTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showRestTimer, restTime, targetRestTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetComplete = (exerciseId: string, setId: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === setId ? { ...set, completed: !set.completed } : set
              ),
            }
          : ex
      )
    );
    
    // Open rest timer
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      setTargetRestTime(exercise.restSeconds);
      setRestTime(0);
      setShowRestTimer(true);
    }
  };

  const handleInputChange = (
    exerciseId: string,
    setId: number,
    field: 'weight' | 'reps',
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === setId ? { ...set, [field]: value } : set
              ),
            }
          : ex
      )
    );
  };

  const handleSwapExercise = (exerciseId: string, newExerciseId: string, newName: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, name: newName, id: newExerciseId }
          : ex
      )
    );
  };

  const handleViewHistory = (exerciseId: string) => {
    setHistoryExerciseId(exerciseId);
    setShowHistory(true);
  };

  const openExerciseDetail = (exercise: ExerciseData) => {
    setSelectedExercise(exercise);
    setShowExerciseDetail(true);
  };

  // Plate calculator logic (supports both kg and lbs)
  const calculatePlates = (targetWeight: number, barWeight: number = unit === 'kg' ? 20 : 45) => {
    const platesKg = [25, 20, 15, 10, 5, 2.5, 1.25];
    const platesLbs = [45, 35, 25, 10, 5, 2.5];
    const plates = unit === 'kg' ? platesKg : platesLbs;
    const perSide = (targetWeight - barWeight) / 2;
    const result: { weight: number; count: number }[] = [];
    
    let remaining = perSide;
    for (const plate of plates) {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        result.push({ weight: plate, count });
        remaining -= count * plate;
      }
    }
    
    return result;
  };

  const getPlateColor = (weight: number) => {
    // Colors for kg plates (Olympic standard colors)
    if (unit === 'kg') {
      switch (weight) {
        case 25: return 'bg-red-500';
        case 20: return 'bg-blue-500';
        case 15: return 'bg-yellow-500';
        case 10: return 'bg-green-500';
        case 5: return 'bg-white text-black';
        case 2.5: return 'bg-red-400';
        case 1.25: return 'bg-gray-400';
        default: return 'bg-gray-500';
      }
    }
    // Colors for lbs plates
    switch (weight) {
      case 45: return 'bg-blue-500';
      case 35: return 'bg-yellow-500';
      case 25: return 'bg-green-500';
      case 10: return 'bg-white text-black';
      case 5: return 'bg-blue-300';
      case 2.5: return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/workout" className="p-2 -ml-2">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-lg">{formatTime(elapsedTime)}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="flex items-center justify-between">
                <span>Warm-up Sets</span>
                <Switch checked={warmupMode} onCheckedChange={setWarmupMode} />
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center justify-between">
                <span>Deload Mode (-40%)</span>
                <Switch checked={deloadMode} onCheckedChange={setDeloadMode} />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')}
                className="flex items-center justify-between"
              >
                <span>Unit System</span>
                <span className="text-xs font-bold text-primary">{unit.toUpperCase()}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPlateCalc(true)}>
                <Calculator className="w-4 h-4 mr-2" />
                Plate Calculator
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-4 pb-3">
          <h1 className="text-xl font-bold">Push Day</h1>
          <p className="text-sm text-muted-foreground">Chest • Shoulders • Triceps</p>
        </div>
      </div>

      {/* Exercises */}
      <div className="px-4 py-4 space-y-4">
        {exercises.map((exercise, exIndex) => {
          const isSuperset = exercise.supersetId;
          const supersetNext = exercises[exIndex + 1]?.supersetId === exercise.supersetId;
          
          return (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: exIndex * 0.1 }}
              className={cn(
                'relative',
                isSuperset && supersetNext && 'pb-0'
              )}
            >
              {/* Superset connector */}
              {isSuperset && supersetNext && (
                <div className="absolute left-4 top-full w-0.5 h-4 bg-gradient-to-b from-primary to-primary/50 z-10" />
              )}
              
              <GlassCard noPadding className="overflow-hidden">
                {/* Exercise Header - Clickable */}
                <button 
                  className="flex items-center justify-between p-4 border-b border-border/50 w-full text-left hover:bg-muted/20 transition-colors"
                  onClick={() => openExerciseDetail(exercise)}
                >
                  <div className="flex items-center gap-3">
                    {isSuperset && (
                      <div className="w-1 h-8 rounded-full bg-gradient-cyber" />
                    )}
                    <div>
                      <h3 className="font-semibold">{exercise.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {exercise.targetSets} sets × {exercise.targetReps} reps
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary">Details</span>
                    <ChevronRight className="w-4 h-4 text-primary" />
                  </div>
                </button>

                {/* Sets Table */}
                <div className="divide-y divide-border/30">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground font-medium bg-muted/30">
                  <div className="col-span-2">SET</div>
                  <div className="col-span-4">PREV</div>
                  <div className="col-span-2">{unit.toUpperCase()}</div>
                  <div className="col-span-2">REPS</div>
                  <div className="col-span-2 text-center">✓</div>
                </div>

                  {/* Warmup sets (if enabled) */}
                  {warmupMode && exIndex === 0 && (
                    <>
                      {[0.5, 0.7, 0.9].map((pct, i) => (
                        <div key={`warmup-${i}`} className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-muted/10 opacity-60">
                          <div className="col-span-2 text-sm font-medium text-warning">W{i + 1}</div>
                          <div className="col-span-4 text-xs text-muted-foreground">
                            {Math.round((exercise.sets[0]?.prevWeight || 0) * pct)} × 8
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              className="h-8 text-center text-sm bg-muted/50"
                              placeholder="—"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              className="h-8 text-center text-sm bg-muted/50"
                              placeholder="—"
                            />
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Working sets */}
                  {exercise.sets.map((set) => (
                    <div
                      key={set.id}
                      className={cn(
                        'grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors',
                        set.completed && 'bg-success/10'
                      )}
                    >
                      <div className="col-span-2 text-sm font-medium">{set.id}</div>
                      <div className="col-span-4 text-xs text-muted-foreground">
                        {set.prevWeight} × {set.prevReps}
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={set.weight}
                          onChange={(e) => handleInputChange(exercise.id, set.id, 'weight', e.target.value)}
                          className="h-8 text-center text-sm"
                          placeholder={String(deloadMode ? Math.round((set.prevWeight || 0) * 0.6) : set.prevWeight)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={set.reps}
                          onChange={(e) => handleInputChange(exercise.id, set.id, 'reps', e.target.value)}
                          className="h-8 text-center text-sm"
                          placeholder={String(set.prevReps)}
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Button
                          variant={set.completed ? 'default' : 'ghost'}
                          size="icon"
                          className={cn(
                            'h-8 w-8',
                            set.completed && 'bg-success hover:bg-success/90'
                          )}
                          onClick={() => handleSetComplete(exercise.id, set.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Set */}
                <button className="w-full py-3 text-sm text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Set
                </button>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Finish Button */}
      <div className="fixed bottom-20 left-4 right-4">
        <Button 
          onClick={() => navigate('/workout')}
          className="w-full bg-gradient-cyber hover:opacity-90 text-primary-foreground font-semibold h-12"
        >
          <Flame className="w-5 h-5 mr-2" />
          Finish Workout
        </Button>
      </div>

      {/* Rest Timer Modal */}
      <AnimatePresence>
        {showRestTimer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center"
            >
              <p className="text-sm text-muted-foreground mb-4 uppercase tracking-wide">Rest Timer</p>
              
              <div className="relative w-48 h-48 mx-auto mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 88}
                    strokeDashoffset={2 * Math.PI * 88 * (1 - restTime / targetRestTime)}
                    className="transition-all duration-1000 drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold font-mono">{formatTime(restTime)}</span>
                  <span className="text-sm text-muted-foreground mt-1">/ {formatTime(targetRestTime)}</span>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowRestTimer(false)}
                  className="min-w-32"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip
                </Button>
                <Button
                  size="lg"
                  onClick={() => setShowRestTimer(false)}
                  className="min-w-32 bg-gradient-cyber hover:opacity-90"
                >
                  I'm Ready
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plate Calculator Modal */}
      <Dialog open={showPlateCalc} onOpenChange={setShowPlateCalc}>
        <DialogContent className="glass border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Plate Calculator
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Target Weight</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')}
                className="text-xs"
              >
                {unit.toUpperCase()}
              </Button>
            </div>
            <Input
              type="number"
              value={calcWeight}
              onChange={(e) => setCalcWeight(e.target.value)}
              placeholder={`Enter weight in ${unit}`}
            />
            
            {calcWeight && Number(calcWeight) >= (unit === 'kg' ? 20 : 45) && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Load per side:</p>
                <div className="flex flex-wrap gap-2">
                  {calculatePlates(Number(calcWeight)).map(({ weight, count }, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {Array.from({ length: count }).map((_, j) => (
                        <div
                          key={j}
                          className={cn(
                            'px-3 py-2 rounded-lg font-bold text-sm',
                            getPlateColor(weight)
                          )}
                        >
                          {weight}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Bar: {unit === 'kg' ? '20 kg' : '45 lbs'} • Each side: {(Number(calcWeight) - (unit === 'kg' ? 20 : 45)) / 2} {unit}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Exercise Detail Sheet */}
      <ExerciseDetailSheet
        exercise={selectedExercise}
        isOpen={showExerciseDetail}
        onClose={() => setShowExerciseDetail(false)}
        onSetComplete={handleSetComplete}
        onInputChange={handleInputChange}
        onSwapExercise={handleSwapExercise}
        onViewHistory={handleViewHistory}
        elapsedTime={elapsedTime}
        unit={unit}
        deloadMode={deloadMode}
      />

      {/* Exercise History Sheet */}
      <ExerciseHistorySheet
        exerciseId={historyExerciseId}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        unit={unit}
      />
    </div>
  );
}
