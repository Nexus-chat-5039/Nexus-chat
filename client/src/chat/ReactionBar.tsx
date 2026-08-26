import React, { memo } from "react";
import { cn } from "../lib/utils";

const EMOJIS = ["👍", "❤️", "😂", "🚀", "💡", "👀"];

export type ReactionBarProps = {
  reactions?: Record<string, string[]>;
  currentUserEmail: string;
  onReact: (emoji: string) => void;
  isMe: boolean;
};

export type QuickReactionPickerProps = {
  onSelect: (emoji: string) => void;
  visible: boolean;
};

export const QuickReactionPicker = memo(
  ({ onSelect, visible }: QuickReactionPickerProps) => {
    if (!visible) return null;

    return (
      <div
        className="inline-flex gap-0.5 bg-nexus-card/95 backdrop-blur-xl border border-nexus-border/50 rounded-full px-1.5 py-1 shadow-xl"
        style={{ animation: "scaleIn 0.15s ease-out forwards" }}
        role="group"
        aria-label="Reaction picker"
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm hover:bg-nexus-hover hover:scale-110 active:scale-95 transition-all duration-150"
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }
);
QuickReactionPicker.displayName = "QuickReactionPicker";

export const ReactionBar = memo(
  ({ reactions, currentUserEmail, onReact, isMe }: ReactionBarProps) => {
    if (!reactions || Object.keys(reactions).length === 0) return null;

    return (
      <div
        className={cn(
          "flex flex-wrap gap-1 mt-1",
          isMe ? "justify-end" : "justify-start"
        )}
      >
        {Object.entries(reactions).map(([emoji, users]) => {
          if (users.length === 0) return null;
          const hasReacted = users.includes(currentUserEmail);

          return (
            <button
              key={emoji}
              type="button"
              aria-label={`Toggle ${emoji} reaction`}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer transition-all duration-150 border",
                hasReacted
                  ? "bg-nexus-primary/15 border-nexus-primary/30 text-nexus-primary"
                  : "bg-nexus-surface/60 border-nexus-border/30 hover:bg-nexus-hover text-nexus-text"
              )}
              onClick={() => onReact(emoji)}
            >
              <span>{emoji}</span>
              <span>{users.length}</span>
            </button>
          );
        })}
      </div>
    );
  }
);
ReactionBar.displayName = "ReactionBar";
