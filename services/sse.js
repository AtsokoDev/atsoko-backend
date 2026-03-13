/**
 * Server-Sent Events (SSE) Service
 * Manages connected clients and broadcasts events to all of them.
 * Kept as a separate module to avoid circular require with server.js.
 */

const sseClients = new Map(); // clientId → res

/**
 * Broadcast an event to ALL connected SSE clients.
 * @param {string} eventName - e.g. 'property:published'
 * @param {object} data      - JSON-serialisable payload
 */
const broadcastEvent = (eventName, data = {}) => {
    if (sseClients.size === 0) return;
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    let dead = [];
    for (const [clientId, res] of sseClients) {
        try {
            res.write(payload);
        } catch {
            dead.push(clientId);
        }
    }
    dead.forEach(id => sseClients.delete(id));
    console.log(`[SSE] Broadcasted "${eventName}" to ${sseClients.size} client(s)`);
};

/**
 * Register a new SSE client connection.
 * @param {string} clientId
 * @param {object} res - Express response object (already in SSE mode)
 */
const addClient = (clientId, res) => {
    sseClients.set(clientId, res);
    console.log(`[SSE] Client connected: ${clientId} (total: ${sseClients.size})`);
};

/**
 * Remove a disconnected SSE client.
 * @param {string} clientId
 */
const removeClient = (clientId) => {
    sseClients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId} (total: ${sseClients.size})`);
};

module.exports = { sseClients, broadcastEvent, addClient, removeClient };
