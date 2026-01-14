import { randomUUID } from "../utils/utils.js";

// src/core/Edge.js

/**
 * Edge represents a connection between two node ports
 */
export class Edge {
  /**
   * Create a new Edge
   * @param {Object} options - Edge configuration
   * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
   * @param {string} options.fromNode - Source node ID
   * @param {string} options.fromPort - Source port ID
   * @param {string} options.toNode - Target node ID
   * @param {string} options.toPort - Target port ID
   */
  constructor({ id, fromNode, fromPort, toNode, toPort }) {
    // Allow empty strings for port names (exec ports use empty names)
    // Only check for null/undefined
    if (fromNode == null || fromPort == null || toNode == null || toPort == null) {
      throw new Error("Edge requires fromNode, fromPort, toNode, and toPort (null/undefined not allowed)");
    }
    this.id = id ?? randomUUID();
    this.fromNode = fromNode;
    this.fromPort = fromPort;
    this.toNode = toNode;
    this.toPort = toPort;
  }
}
