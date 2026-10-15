import React from 'react';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function Icon({ name, type = 'ionicons', size = 20, color = '#10B981', style }) {
  if (type === 'feather') {
    return <Feather name={name} size={size} color={color} style={style} />;
  }
  if (type === 'material') {
    return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
  }
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

