import React from 'react';
import UnifiedResourceHub from './UnifiedResourceHub';

export default function ThemePanel() {
  return (
    <UnifiedResourceHub
      initialCategory="theme"
      isCompact={true}
    />
  );
}
