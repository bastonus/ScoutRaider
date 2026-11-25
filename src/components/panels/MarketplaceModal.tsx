import React from 'react';
import { Boxes } from 'lucide-react';
import UnifiedResourceHub, { UnifiedCategory } from './UnifiedResourceHub';
import Modal from '../common/Modal';
import { useViewport } from '../../hooks';

interface MarketplaceModalProps {
  onClose: () => void;
  initialCategory?: string;
}

export default function MarketplaceModal({ onClose, initialCategory = 'all' }: MarketplaceModalProps) {
  const { isMobile } = useViewport();
  const cat: UnifiedCategory = 
    initialCategory === 'maps' ? 'maps' :
    initialCategory === 'code' ? 'code' :
    initialCategory === 'orchestration' ? 'orchestration' :
    initialCategory === 'theme' ? 'theme' :
    initialCategory === 'my_library' ? 'my_library' : 'all';

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Boxes size={16} color="var(--accent-hover)" aria-hidden="true" />
          Marketplace & Ressources
        </span>
      }
      onClose={onClose}
      width="1100px"
      maxWidth="96vw"
      height="88dvh"
      maxHeight="92dvh"
      fullScreenMobile
      isMobile={isMobile}
    >
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <UnifiedResourceHub
          initialCategory={cat}
          isCompact={false}
        />
      </div>
    </Modal>
  );
}
