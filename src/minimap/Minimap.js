/**
 * Minimap - Shows overview of entire graph with viewport indicator
 */
export class Minimap {
    constructor(container, { graph, renderer, width = 200, height = 150 } = {}) {
        this.graph = graph;
        this.renderer = renderer;
        this.width = width;
        this.height = height;

        // Create canvas element
        this.canvas = document.createElement("canvas");
        this.canvas.id = "minimap";
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.position = "fixed";
        this.canvas.style.bottom = "20px";
        this.canvas.style.right = "20px";
        this.canvas.style.border = "2px solid #444";
        this.canvas.style.borderRadius = "8px";
        this.canvas.style.background = "rgba(10, 14, 18, 0.92)";
        this.canvas.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.6)";
        this.canvas.style.pointerEvents = "auto";
        this.canvas.style.cursor = "crosshair";

        this.ctx = this.canvas.getContext("2d");

        // Add to container
        container.appendChild(this.canvas);

        this._setupInteractions();
    }

    _setupInteractions() {
        let isDragging = false;

        const handleInteraction = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const worldX = (mx - this.lastOffsetX) / this.lastScale + this.lastMinX;
            const worldY = (my - this.lastOffsetY) / this.lastScale + this.lastMinY;

            this.renderer.setTransform({
                offsetX: -worldX * this.renderer.scale + this.renderer.width / 2,
                offsetY: -worldY * this.renderer.scale + this.renderer.height / 2,
            });
        };

        this.canvas.addEventListener("mousedown", (e) => {
            isDragging = true;
            handleInteraction(e);
            this.canvas.style.cursor = "grabbing";
        });

        // Store refs so destroy() can remove them
        this._onWindowMouseMove = (e) => { if (isDragging) handleInteraction(e); };
        this._onWindowMouseUp   = () => { isDragging = false; this.canvas.style.cursor = "crosshair"; };
        window.addEventListener("mousemove", this._onWindowMouseMove);
        window.addEventListener("mouseup",   this._onWindowMouseUp);
    }

    /**
     * Render the minimap
     */
    render() {
        const { graph, renderer, ctx, width: w, height: h } = this;

        // Clear
        ctx.fillStyle = "#0a0e12";
        ctx.fillRect(0, 0, w, h);

        if (graph.nodes.size === 0) return;

        // Calculate bounds of all nodes
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const node of graph.nodes.values()) {
            const { x, y, w: nw, h: nh } = node.computed;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + nw);
            maxY = Math.max(maxY, y + nh);
        }

        // Add margin to the bounds
        const margin = 100; // World units margin
        const graphWidth = Math.max(300, maxX - minX + margin * 2);
        const graphHeight = Math.max(200, maxY - minY + margin * 2);

        // Adjust minX and minY to center the content
        minX -= margin;
        minY -= margin;

        const padding = 10;

        const scale = Math.min(
            (w - padding * 2) / graphWidth,
            (h - padding * 2) / graphHeight
        );

        const offsetX = (w - graphWidth * scale) / 2;
        const offsetY = (h - graphHeight * scale) / 2;

        // Store for interaction mapping
        this.lastScale = scale;
        this.lastOffsetX = offsetX;
        this.lastOffsetY = offsetY;
        this.lastMinX = minX;
        this.lastMinY = minY;

        // Draw edges
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        for (const edge of graph.edges.values()) {
            const fromNode = graph.nodes.get(edge.fromNode);
            const toNode = graph.nodes.get(edge.toNode);
            if (!fromNode || !toNode) continue;

            // Get center points of nodes
            const x1 = fromNode.computed.x + fromNode.computed.w / 2;
            const y1 = fromNode.computed.y + fromNode.computed.h / 2;
            const x2 = toNode.computed.x + toNode.computed.w / 2;
            const y2 = toNode.computed.y + toNode.computed.h / 2;

            // Transform to minimap coordinates
            const mx1 = (x1 - minX) * scale + offsetX;
            const my1 = (y1 - minY) * scale + offsetY;
            const mx2 = (x2 - minX) * scale + offsetX;
            const my2 = (y2 - minY) * scale + offsetY;

            ctx.beginPath();
            ctx.moveTo(mx1, my1);
            ctx.lineTo(mx2, my2);
            ctx.stroke();
        }

        // Draw nodes
        ctx.fillStyle = "#6cf";
        for (const node of graph.nodes.values()) {
            const { x, y, w: nw, h: nh } = node.computed;
            const mx = (x - minX) * scale + offsetX;
            const my = (y - minY) * scale + offsetY;
            const mw = nw * scale;
            const mh = nh * scale;

            if (node.type === "core/Group") {
                ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
                ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
                ctx.lineWidth = 1;
                ctx.fillRect(mx, my, mw, mh);
                ctx.strokeRect(mx, my, mw, mh);
            } else {
                ctx.fillStyle = "#3B3B3B";
                ctx.fillRect(mx, my, Math.max(3, mw), Math.max(3, mh));
                
                // Active node indicator in minimap if possible? 
                // For now, let's just make them consistent.
            }
        }

        // Draw viewport rectangle
        const vx0 = -renderer.offsetX / renderer.scale;
        const vy0 = -renderer.offsetY / renderer.scale;
        const vw = renderer.width  / renderer.scale;
        const vh = renderer.height / renderer.scale;

        const vmx = (vx0 - minX) * scale + offsetX;
        const vmy = (vy0 - minY) * scale + offsetY;
        const vmw = vw * scale;
        const vmh = vh * scale;

        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vmx, vmy, vmw, vmh);
        
        // Fill viewport area with very subtle tint
        ctx.fillStyle = "rgba(52, 211, 153, 0.05)";
        ctx.fillRect(vmx, vmy, vmw, vmh);
    }

    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener("mousemove", this._onWindowMouseMove);
        window.removeEventListener("mouseup",   this._onWindowMouseUp);
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }
}
