import React from 'react';
import UnifiedResourceHub from './UnifiedResourceHub';

interface MapLibraryPanelProps {
  onSetRightSection?: (id: any) => void;
  onPreferencesOpen?: () => void;
}

export default function MapLibraryPanel({ onSetRightSection, onPreferencesOpen }: MapLibraryPanelProps) {
  return (
    <UnifiedResourceHub
      initialCategory="maps"
      isCompact={true}
      onPreferencesOpen={onPreferencesOpen}
    />
  );
}
