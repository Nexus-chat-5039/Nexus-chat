import Modal from "./Modal"
import NexusAvatar from "./ui/NexusAvatar"
import type { Group } from "../types"

type Props = {
  isOpen: boolean
  onClose: () => void
  group: Group
  currentUserEmail: string
  onLeave: (groupId: string) => void
  onRemoveMember: (groupId: string, email: string) => void
}

export default function GroupDetailsModal({
  isOpen, onClose, group, currentUserEmail, onLeave, onRemoveMember,
}: Props) {
  const isOwner = group.user_id === currentUserEmail
  const isPersonal = group.id.startsWith("personal_")

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Group Details">
      <div className="flex flex-col gap-5">
        {/* Group header */}
        <div className="bg-nexus-surface/60 p-4 rounded-xl border border-nexus-border/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">{group.name}</h3>
            {!isPersonal && !isOwner && (
              <button
                onClick={() => { onLeave(group.id); onClose() }}
                className="px-3 py-1.5 bg-red-500/10 text-red-400/80 hover:bg-red-500/20 rounded-lg text-xs transition-all border border-red-500/20 font-medium"
              >
                Exit Group
              </button>
            )}
            {isOwner && !isPersonal && (
              <span className="text-[10px] text-nexus-muted italic bg-nexus-card px-2 py-1 rounded-md">Owner</span>
            )}
          </div>
          {group.invite_code && (
            <div
              className="flex items-center gap-2 bg-nexus-bg/60 rounded-lg px-3 py-2 cursor-pointer hover:bg-nexus-bg/80 transition-colors border border-nexus-border/20"
              onClick={() => navigator.clipboard.writeText(group.invite_code!)}
              title="Click to copy invite code"
            >
              <span className="text-[9px] uppercase tracking-wider text-nexus-muted/60 font-semibold">Invite Code</span>
              <span className="text-sm font-mono font-bold text-nexus-primary tracking-widest">{group.invite_code}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-nexus-muted/40 ml-auto">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <h4 className="text-[10px] font-semibold text-nexus-primary uppercase tracking-wider mb-2.5">
            Members ({(group.members || []).length})
          </h4>
          <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-thin">
            {(group.members || []).map((member) => (
              <div
                key={member}
                className="flex items-center justify-between p-2.5 rounded-xl bg-nexus-input/50 hover:bg-nexus-hover/50 transition-all group/member"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <NexusAvatar name={member} size="sm" />
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm truncate ${member === currentUserEmail ? "font-semibold text-nexus-text" : "text-nexus-text/70"}`}>
                      {member === currentUserEmail ? `${member} (You)` : member}
                    </span>
                    {group.user_id === member && (
                      <span className="text-[9px] text-nexus-primary/70">Owner</span>
                    )}
                  </div>
                </div>
                {isOwner && member !== currentUserEmail && (
                  <button
                    onClick={() => onRemoveMember(group.id, member)}
                    className="opacity-0 group-hover/member:opacity-100 text-red-400/60 hover:text-red-400 text-[10px] px-2 py-1 rounded-md hover:bg-red-500/10 transition-all"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
