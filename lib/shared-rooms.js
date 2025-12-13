// Shared room registry accessible from both WebSocket server and API routes
// This ensures a single source of truth for room state

const rooms = new Map();

/**
 * Get a room by code
 * @param {string} code - Room code
 * @returns {object|undefined} Room object or undefined
 */
function get(code) {
  return rooms.get(code);
}

/**
 * Set a room
 * @param {string} code - Room code
 * @param {object} room - Room object
 */
function set(code, room) {
  rooms.set(code, room);
}

/**
 * Check if room exists
 * @param {string} code - Room code
 * @returns {boolean}
 */
function has(code) {
  return rooms.has(code);
}

/**
 * Delete a room
 * @param {string} code - Room code
 * @returns {boolean}
 */
function remove(code) {
  return rooms.delete(code);
}

/**
 * Get all rooms as an array
 * @returns {Array} All rooms
 */
function list() {
  return Array.from(rooms.values());
}

/**
 * Get all room entries for iteration
 * @returns {IterableIterator}
 */
function entries() {
  return rooms.entries();
}

/**
 * Get room count
 * @returns {number}
 */
function size() {
  return rooms.size;
}

module.exports = {
  get,
  set,
  has,
  remove,
  list,
  entries,
  size,
};
