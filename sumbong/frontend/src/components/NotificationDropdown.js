import React from 'react';

const typeLabel = (n) => {
  switch (n.type) {
    case 'new_user': return 'New User';
    case 'new_complaint': return 'New Complaint';
    case 'user_feedback': return 'User Reply';
    default: return n.type;
  }
};

const NotificationDropdown = ({ notifications, onSelect, onMarkAll, onMarkSingle, onLoadMore, hasMore, loading, onDelete, onClearAll }) => {
  return (
    <div className="admin-bell-dropdown" role="menu" aria-label="Notifications">
      <div className="admin-bell-header">
        <span>Notifications</span>
        <div className="admin-bell-actions">
          <button onClick={onMarkAll} disabled={!notifications.some(n => !n.read)}>Mark all read</button>
          <button onClick={onClearAll} disabled={notifications.length===0} style={{marginLeft:8}}>Clear all</button>
        </div>
      </div>
      <div className="admin-bell-list" role="list">
        {loading && notifications.length === 0 && (
          <div className="admin-bell-empty">Loading...</div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="admin-bell-empty">No notifications</div>
        )}
        {notifications.map(n => {
          const actorName = n.meta?.actorFullName || n.meta?.actorFirst ? `${n.meta?.actorFirst||''} ${n.meta?.actorLast||''}`.trim() : null;
          const preview = n.meta?.preview;
          return (
            <div
              key={n._id}
              className={`admin-bell-item ${n.read ? 'read' : 'unread'}`}
              role="listitem"
            >
              <div className="admin-bell-item-main" onClick={() => onSelect(n)}>
                <div className="admin-bell-item-top">
                  <span className="admin-bell-type">{typeLabel(n)}</span>
                  <time className="admin-bell-time" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                </div>
                <div className="admin-bell-msg">
                  {actorName && <strong style={{marginRight:4}}>{actorName}:</strong>}{n.message}
                </div>
                {preview && (
                  <div className="admin-bell-preview">{preview}</div>
                )}
              </div>
              <div className="admin-bell-item-actions">
                {!n.read && (
                  <button className="admin-bell-mark" onClick={(e) => { e.stopPropagation(); onMarkSingle(n._id); }} title="Mark read" aria-label="Mark notification read">•</button>
                )}
                <button className="admin-bell-del" onClick={(e)=>{ e.stopPropagation(); onDelete(n._id); }} aria-label="Delete notification" title="Delete">×</button>
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button className="admin-bell-load-more" onClick={onLoadMore}>Load more</button>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
