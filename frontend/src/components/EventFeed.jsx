function EventFeed({ events }) {
  return (
    <section className="panel feed-panel">
      <div className="panel__header">
        <p className="panel__eyebrow">Bottom Feed</p>
        <h2 className="panel__title">System Events</h2>
      </div>
      <div className="panel__body">
        <div className="feed-list">
          {events.length > 0 ? events.map((event) => (
            <article className="feed-item" key={`${event.time}-${event.message}`}>
              <span className={`feed-item__badge feed-item__badge--${event.level.toLowerCase()}`}>
                {event.level}
              </span>
              <div className="feed-item__text">{event.message}</div>
              <div className="feed-item__meta">{event.time}</div>
            </article>
          )) : (
            <article className="feed-item">
              <div className="feed-item__text">Waiting for live system events.</div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

export default EventFeed;
