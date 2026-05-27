import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import * as d3 from "d3"
import type { GraphNode, GraphEdge } from "../shared"

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const STATUS_COLORS: Record<string, string> = {
  VIVENDE:    "#4a7a4a",
  MORTIS:     "#8a2a2a",
  IGNOTUS:    "#3a5800",
  HOSTILIS:   "#8a3a00",
  FOEDERATUS: "#2a5a7a",
  INQUISITUS: "#5a3a7a",
}

const TYPE_SHAPES: Record<string, string> = {
  NPC:      "circle",
  Location: "rect",
  Faction:  "diamond",
  Item:     "triangle",
  Other:    "circle",
}

function nodeColor(n: GraphNode): string {
  if (n.status && STATUS_COLORS[n.status]) return STATUS_COLORS[n.status]
  return "#4a3a20"
}

export function ThreatGraph({ nodes, edges }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const rect = svgRef.current.getBoundingClientRect()
    const W = rect.width || 900
    const H = rect.height || 600

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })
    svg.call(zoom as any)

    const g = svg.append("g")

    // Compute connection counts for node sizing
    const connCount = new Map<string, number>()
    for (const e of edges) {
      connCount.set(e.from_id, (connCount.get(e.from_id) ?? 0) + 1)
      connCount.set(e.to_id, (connCount.get(e.to_id) ?? 0) + 1)
    }

    const nodeRadius = (n: GraphNode) => {
      const conns = connCount.get(n.id) ?? 0
      return Math.max(10, Math.min(28, 10 + conns * 3))
    }

    // Build simulation data
    type SimNode = GraphNode & d3.SimulationNodeDatum & { r: number }
    type SimEdge = { source: SimNode; target: SimNode; data: GraphEdge }

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n, r: nodeRadius(n) }))
    const nodeById = new Map(simNodes.map((n) => [n.id, n]))

    const simEdges: SimEdge[] = edges
      .map((e) => {
        const source = nodeById.get(e.from_id)
        const target = nodeById.get(e.to_id)
        if (!source || !target) return null
        return { source, target, data: e }
      })
      .filter((e): e is SimEdge => e !== null)

    // Force simulation
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimEdge>(simEdges)
        .id((n) => n.id)
        .distance(120))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((n) => n.r + 8))

    // Arrow markers for edges
    svg.append("defs").selectAll("marker")
      .data(["ai", "manual"])
      .enter().append("marker")
      .attr("id", (d) => `arrow-${d}`)
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", (d) => d === "manual" ? "#c8a96e" : "#5a4a30")

    // Draw edges
    const link = g.append("g").attr("class", "links")
      .selectAll("line")
      .data(simEdges)
      .enter().append("line")
      .attr("stroke", (d) => d.data.source === "manual" ? "#5a4a30" : "#3a2a18")
      .attr("stroke-width", (d) => d.data.source === "manual" ? 1.5 : 1)
      .attr("stroke-opacity", (d) => d.data.source === "manual" ? 0.8 : 0.5)
      .attr("marker-end", (d) => `url(#arrow-${d.data.source})`)

    // Edge labels
    const linkLabel = g.append("g").attr("class", "link-labels")
      .selectAll("text")
      .data(simEdges)
      .enter().append("text")
      .attr("fill", "#3a2a18")
      .attr("font-size", "8px")
      .attr("font-family", "monospace")
      .attr("text-anchor", "middle")
      .attr("dy", "-3")
      .text((d) => d.data.relation_type.replace(/_/g, " "))

    // Draw nodes
    const node = g.append("g").attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (_event, d) => navigate(`/wiki/${d.id}`))
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          }) as any
      )

    // Node shape based on entity type
    node.each(function(d) {
      const el = d3.select(this)
      const r = d.r
      const col = nodeColor(d)

      if (TYPE_SHAPES[d.type] === "rect") {
        el.append("rect")
          .attr("x", -r).attr("y", -r * 0.7)
          .attr("width", r * 2).attr("height", r * 1.4)
          .attr("fill", col + "33")
          .attr("stroke", col)
          .attr("stroke-width", 1.5)
      } else if (TYPE_SHAPES[d.type] === "diamond") {
        const pts = `0,${-r} ${r},0 0,${r} ${-r},0`
        el.append("polygon")
          .attr("points", pts)
          .attr("fill", col + "33")
          .attr("stroke", col)
          .attr("stroke-width", 1.5)
      } else if (TYPE_SHAPES[d.type] === "triangle") {
        el.append("polygon")
          .attr("points", `0,${-r} ${r * 0.87},${r * 0.5} ${-r * 0.87},${r * 0.5}`)
          .attr("fill", col + "33")
          .attr("stroke", col)
          .attr("stroke-width", 1.5)
      } else {
        el.append("circle")
          .attr("r", r)
          .attr("fill", col + "33")
          .attr("stroke", col)
          .attr("stroke-width", 1.5)
      }

      // Status indicator ring
      if (d.status) {
        el.append("circle")
          .attr("r", r + 3)
          .attr("fill", "none")
          .attr("stroke", col)
          .attr("stroke-width", 0.5)
          .attr("stroke-opacity", 0.4)
          .attr("stroke-dasharray", "2,3")
      }
    })

    // Node labels
    node.append("text")
      .attr("dy", (d) => d.r + 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#c8a96e")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .text((d) => d.name)

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "threat-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("opacity", 0)

    node
      .on("mouseenter", (_event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<div class="tt-name">${d.name}</div>` +
            `<div class="tt-type">${d.type}${d.status ? ` · ${d.status}` : ""}</div>` +
            `<div class="tt-conn">${connCount.get(d.id) ?? 0} FORBINDELSER</div>`
          )
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", `${event.pageX + 14}px`)
          .style("top", `${event.pageY - 28}px`)
      })
      .on("mouseleave", () => tooltip.style("opacity", 0))

    // Simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!)

      linkLabel
        .attr("x", (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr("y", (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2)

      node.attr("transform", (d) => `translate(${d.x!},${d.y!})`)
    })

    return () => {
      simulation.stop()
      tooltip.remove()
    }
  }, [nodes, edges, navigate])

  return <svg ref={svgRef} className="threat-graph-svg" />
}
