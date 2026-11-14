import React from 'react';
import UnifiedResourceHub from './UnifiedResourceHub';

export default function LibraryPanel() {
  return (
    <UnifiedResourceHub
      initialCategory="code"
      isCompact={true}
    />
  );
}
