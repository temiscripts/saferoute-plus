# escalation-engine

SOS trigger logic + deadman-switch timer + tiered contact escalation + live location streaming.

**Owner:** Project lead.
**Status:** scaffolded (implementation pending — depends on backend-api).

## Responsibilities

- Watch active sessions and detect missed check-ins (deadman switch).
- On SOS trigger, notify tier-1 trusted contacts. If no ack within `ESCALATION_ACK_WINDOW_SECONDS`, escalate to tier-2, then tier-3.
- Stream live location updates to acknowledged contacts.
- Emit events the mobile app and backend can subscribe to.

## Run

(See implementation once present.)

## Demo Day talking point

"The deadman switch is the trust layer — even if she can't reach her phone, the absence of a check-in is itself the signal, and the engine escalates contact-by-contact until someone answers."
