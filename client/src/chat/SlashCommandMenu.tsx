import React, { useEffect, useRef } from 'react';
import { FileText, HelpCircle, Code, Languages, Target, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export type SlashCommand = {
  command: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  action: 'ai' | 'local';
  template?: string;
};

// eslint-disable-next-line react-refresh/only-export-components
export const COMMANDS: SlashCommand[] = [
  {
    command: '/summarize',
    icon: <FileText className="w-4 h-4" />,
    label: 'Summarize',
    description: 'Summarize recent conversation',
    action: 'ai',
    template: 'Summarize the last 20 messages in this conversation'
  },
  {
    command: '/explain',
    icon: <HelpCircle className="w-4 h-4" />,
    label: 'Explain',
    description: 'Explain a topic in detail',
    action: 'ai',
    template: 'Explain in detail: {input}'
  },
  {
    command: '/code',
    icon: <Code className="w-4 h-4" />,
    label: 'Generate Code',
    description: 'Write code for a task',
    action: 'ai',
    template: 'Write code for: {input}'
  },
  {
    command: '/translate',
    icon: <Languages className="w-4 h-4" />,
    label: 'Translate',
    description: 'Translate text to English',
    action: 'ai',
    template: 'Translate the following to English: {input}'
  },
  {
    command: '/goal',
    icon: <Target className="w-4 h-4" />,
    label: 'Set Goal',
    description: 'Set a goal and track progress',
    action: 'ai',
    template: 'Help me create an actionable plan with milestones for this goal: {input}'
  },
  {
    command: '/help',
    icon: <Info className="w-4 h-4" />,
    label: 'Help',
    description: 'Show available commands',
    action: 'local'
  }
];

// eslint-disable-next-line react-refresh/only-export-components
export const getFilteredCommands = (filter: string): SlashCommand[] => {
  const normalizedFilter = filter.toLowerCase();
  return COMMANDS.filter(cmd => cmd.command.toLowerCase().includes(normalizedFilter));
};

type Props = {
  filter: string;
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose?: () => void;
  visible: boolean;
};

const SlashCommandMenu = React.memo(({ filter, activeIndex, onSelect, visible }: Props) => {
  const filteredCommands = getFilteredCommands(filter);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll active item into view
    if (scrollRef.current && filteredCommands.length > 0) {
      const activeEl = scrollRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeIndex, filteredCommands.length]);

  if (!visible || filteredCommands.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div 
        className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-nexus-card/95 backdrop-blur-xl border border-nexus-border/50 shadow-2xl z-50 overflow-hidden"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        <div className="text-[10px] uppercase tracking-wider text-nexus-muted/60 font-semibold px-3 pt-2 pb-1">
          Commands
        </div>
        <div ref={scrollRef} className="max-h-64 overflow-y-auto scrollbar-thin flex flex-col p-1 gap-0.5">
          {filteredCommands.map((command, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={command.command}
                type="button"
                className={cn(
                  "w-full px-3 py-2.5 flex items-center gap-3 rounded-lg text-left transition-colors duration-150",
                  isActive ? "bg-nexus-primary/10 text-nexus-primary" : "text-nexus-text hover:bg-nexus-hover",
                  "focus:outline-none"
                )}
                onClick={() => onSelect(command)}
                aria-label={`Select command ${command.command}`}
              >
                <div className={cn(
                  "shrink-0 flex items-center justify-center p-1.5 rounded-md",
                  isActive ? "text-nexus-primary" : "text-nexus-muted"
                )}>
                  {command.icon}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">
                    {command.command} <span className="text-nexus-muted/60 text-xs ml-1 font-normal">{command.label}</span>
                  </span>
                  <span className={cn(
                    "text-xs truncate",
                    isActive ? "text-nexus-primary/70" : "text-nexus-muted"
                  )}>
                    {command.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

export default SlashCommandMenu;
