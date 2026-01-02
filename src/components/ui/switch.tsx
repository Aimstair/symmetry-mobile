import React from 'react';
import { Switch as RNSwitch, SwitchProps } from 'react-native';
import { cn } from '@/lib/utils';

interface CustomSwitchProps extends SwitchProps {
  id?: string;
  defaultChecked?: boolean;
}

export function Switch({ 
  id, 
  defaultChecked, 
  value,
  ...props 
}: CustomSwitchProps) {
  return (
    <RNSwitch
      value={value ?? defaultChecked}
      trackColor={{ false: '#27272A', true: '#31D5E3' }}
      thumbColor={value || defaultChecked ? '#FFFFFF' : '#71717A'}
      ios_backgroundColor="#27272A"
      {...props}
    />
  );
}
