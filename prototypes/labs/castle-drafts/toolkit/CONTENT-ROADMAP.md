# City content expansion

Build in this order, validating entrances and traversal before scaling the content.

## 1. Enterable building kit — current work

The interior workshop exposes 36 ordinary building profiles, including all shop trades, homes, slum dwellings, pub, inn, smithy, warehouse, chapel, tower house, and the three multi-wing compounds. Profiles use appropriate footprints and floor counts; the streaming preview explicitly retains its smaller two-storey lots until its lot planner supports larger buildings.

Interior destinations have deterministic IDs based on building ID and purpose. They identify a service counter, resident, receiving area or workplace; they are foundations for future NPCs and deliveries, not active quest interactions yet.

Multi-wing compounds have individually accessible wings around an outdoor court. They do not yet have indoor cross-wing passages. The guild remains a unique landmark, rather than an ordinary repeatable profile.

Traversal checks cover entrances, every stair flight, headroom, floor seams and compound wing access. Door animation, furniture interactions, residents and additional alternate room arrangements remain content work.

## 2. Circular anime-inspired city

Replace the repeated square preview blocks with a persistent city plan: outer walls and gates, ring streets, radial approaches, connected districts, small lanes and courtyard blocks. Fit large lots intentionally and preserve entrances and stepped sidewalks on elevation changes. Keep the streaming and batching systems; geometry should follow the city plan rather than determine it.

Introduce stable street, district, building and entrance IDs here, followed by readable street names, odd/even addresses, courtyard addresses and door numbers. Addresses must survive chunk eviction and regeneration. Quest routing targets a reachable entrance and interior destination, not the building centre.

## 3. Hero buildings and public spaces

Author the adventurers' guild, cathedral, castle and main plaza as distinctive connected landmarks with bespoke silhouettes, approaches and interiors. Reserve their sites in the city plan. The guild needs a reception, commission board, meeting area and delivery counter. Avoid repeating unique landmarks as random ordinary lots.

## 4. Guild delivery loop

Start with one playable loop: accept a guild commission, read a named recipient and address, navigate there, knock or enter a public business, hand over the parcel, receive acknowledgement, and return to the guild. Persist quest and recipient state independently of streamed geometry. No looting is required.

After this loop works, expand to multi-stop errands, custom orders, appointments, neighbourhood relationships and service requests. Add variety through people and places before increasing quest volume.
