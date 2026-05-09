import React from 'react'
import { X, Plus } from 'lucide-react'

interface Tab { id: string; title: string; icon?: React.ReactNode; }
interface ChromeTabsProps {
  tabs: Tab[];
  activeTab: number;
  onTabSelect: (index: number) => void;
  onTabClose: (id: string) => void;
  onAddTab: () => void;
}

export default function ChromeTabs({ tabs, activeTab, onTabSelect, onTabClose, onAddTab }: ChromeTabsProps) {
  return (
    <div className="chrome-tabs">
      {tabs.map((tab, index) => (
        <div 
          key={tab.id}
          className={`chrome-tab ${activeTab === index ? 'active' : ''}`}
          onClick={() => onTabSelect(index)}
        >
          {tab.icon}
          <span className="tab-title">{tab.title}</span>
          <div 
            className="tab-x" 
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
          >
            <X size={10} />
          </div>
        </div>
      ))}
      <div className="tab-add-btn" onClick={onAddTab}>
        <Plus size={14} />
      </div>
    </div>
  )
}
