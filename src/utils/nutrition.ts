// src/utils/nutrition.ts
import { NutritionTargets, User } from '@/types';

export function calculateNutritionTargets(
  user: Pick<User, 'weight' | 'height' | 'age' | 'gender' | 'goal'>,
  frequency: number // workouts per week
): NutritionTargets {
  // 1. Calculate BMR (Mifflin-St Jeor Equation)
  // Weight in kg, Height in cm
  let bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age;
  
  if (user.gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  // 2. Estimate TDEE based on activity (workout frequency)
  let activityMultiplier = 1.2; // Sedentary base
  if (frequency >= 6) activityMultiplier = 1.725;      // Heavy exercise
  else if (frequency >= 4) activityMultiplier = 1.55;  // Moderate exercise
  else if (frequency >= 2) activityMultiplier = 1.375; // Light exercise
  
  const tdee = Math.round(bmr * activityMultiplier);

  // 3. Adjust for Goal
  let targetCalories = tdee;
  switch (user.goal) {
    case 'bulk':
      targetCalories += 300; // Surplus
      break;
    case 'cut':
      targetCalories -= 500; // Deficit
      break;
    case 'recomp':
      targetCalories -= 200; // Slight deficit
      break;
    case 'maintenance':
    default:
      targetCalories = tdee;
      break;
  }

  // 4. Calculate Macros
  // Protein: 2.2g per kg of bodyweight (approx 1g/lb)
  const protein = Math.round(user.weight * 2.2);
  
  // Fats: 0.8g per kg of bodyweight
  const fats = Math.round(user.weight * 0.8);
  
  // Carbs: Remaining calories (Protein/Carbs = 4cal/g, Fats = 9cal/g)
  const proteinCals = protein * 4;
  const fatCals = fats * 9;
  const remainingCals = targetCalories - proteinCals - fatCals;
  const carbs = Math.max(0, Math.round(remainingCals / 4));

  return {
    calories: targetCalories,
    protein,
    fats,
    carbs,
    tdee,
  };
}