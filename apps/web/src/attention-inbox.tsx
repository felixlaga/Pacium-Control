export function UnreadAttentionMarker({ unread }: { unread: boolean }) {
  if (!unread) {
    return null;
  }
  return (
    <span aria-label="Unread attention" className="attention-unread-marker">
      <span aria-hidden="true" />
    </span>
  );
}

export function AttentionCursorHeader({
  muted,
  onToggleMuted,
  unread,
}: {
  muted: boolean;
  onToggleMuted: () => void;
  unread: boolean;
}) {
  return (
    <div className="attention-cursor-header">
      <span>
        <h2>Attention</h2>
        <small>{unread ? "Unread event" : "Seen"}</small>
      </span>
      <button aria-pressed={muted} onClick={onToggleMuted} type="button">
        {muted ? "Unmute alerts" : "Mute alerts"}
      </button>
    </div>
  );
}
