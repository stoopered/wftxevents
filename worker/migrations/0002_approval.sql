-- Bookings now start as 'pending' and only hold a slot once an admin approves.
ALTER TABLE bookings ADD COLUMN decided_at INTEGER;
