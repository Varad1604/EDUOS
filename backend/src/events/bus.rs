use tokio::sync::broadcast;
use crate::events::types::DomainEvent;

/// In-memory event bus backed by a tokio broadcast channel.
/// All domain modules publish here; subscribers (projectors, sagas) listen.
pub struct EventBus {
    sender: broadcast::Sender<DomainEvent>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Publish a domain event. Returns the number of active receivers.
    pub fn publish(&self, event: DomainEvent) -> usize {
        match self.sender.send(event) {
            Ok(n) => n,
            Err(_) => 0, // No receivers — fine for MVP
        }
    }

    /// Subscribe to all domain events.
    pub fn subscribe(&self) -> broadcast::Receiver<DomainEvent> {
        self.sender.subscribe()
    }
}
