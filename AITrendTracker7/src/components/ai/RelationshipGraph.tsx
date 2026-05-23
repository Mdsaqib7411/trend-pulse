import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';

export interface GraphNode {
  id: string;
  label: string;
  weight: number; // 0 to 1
  isCenter?: boolean;
}

interface RelationshipGraphProps {
  nodes: GraphNode[];
  width?: number;
  height?: number;
}

/**
 * High-Performance Static Relationship Graph.
 * STRICT ENFORCEMENT: Zero runtime physics. Uses a static radial trigonometric layout.
 * Node budget: Max 8 outer nodes.
 */
export const RelationshipGraph = React.memo(({
  nodes,
  width = 300,
  height = 180,
}: RelationshipGraphProps) => {

  const { centerNode, outerNodes, accessibilitySummary } = useMemo(() => {
    // 1. Budget enforcement (Max 8 nodes to guarantee zero engine lag)
    const activeNodes = nodes.slice(0, 9); 
    
    // 2. Identify Center
    let centerIndex = activeNodes.findIndex(n => n.isCenter);
    if (centerIndex === -1) centerIndex = 0; // Fallback
    
    const center = activeNodes[centerIndex];
    const outer = activeNodes.filter((_, idx) => idx !== centerIndex);

    // 3. Screen Reader textual fallback map
    const summary = `Relationship network for ${center?.label || 'main trend'}. Connections: ` + 
      outer.map(n => `${n.label} (Strength: ${Math.round(n.weight * 100)}%)`).join(', ');

    return { centerNode: center, outerNodes: outer, accessibilitySummary: summary };
  }, [nodes]);

  // Precompute static coordinates
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 30; // 30px padding

  const renderLinesAndNodes = () => {
    const angleStep = (2 * Math.PI) / (outerNodes.length || 1);
    
    const elements: React.ReactNode[] = [];

    // Edges
    outerNodes.forEach((node, i) => {
      const angle = i * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      const strokeWidth = 1 + (node.weight * 3);
      const opacity = 0.2 + (node.weight * 0.5);

      elements.push(
        <Line
          key={`edge-${node.id}`}
          x1={centerX}
          y1={centerY}
          x2={x}
          y2={y}
          stroke={colors.neon.cyan}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    });

    // Outer Nodes
    outerNodes.forEach((node, i) => {
      const angle = i * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      elements.push(
        <React.Fragment key={`node-${node.id}`}>
          <Circle
            cx={x}
            cy={y}
            r={6 + (node.weight * 6)}
            fill={colors.background.secondary}
            stroke={colors.border.active}
            strokeWidth={1.5}
          />
          <SvgText
            x={x}
            y={y + 18}
            fontSize="8"
            fill={colors.text.secondary}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {node.label}
          </SvgText>
        </React.Fragment>
      );
    });

    return elements;
  };

  if (!centerNode) return null;

  return (
    <View 
      style={[styles.container, { width, height }]} 
      accessible={true} 
      accessibilityRole="image"
      accessibilityLabel={accessibilitySummary}
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="centerGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={colors.neon.purple} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={colors.neon.purple} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {renderLinesAndNodes()}

        {/* Center Node Glow */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={25}
          fill="url(#centerGlow)"
        />
        {/* Center Node Solid */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={12}
          fill={colors.neon.purple}
          stroke={colors.text.primary}
          strokeWidth={2}
        />
        <SvgText
          x={centerX}
          y={centerY - 20}
          fontSize="10"
          fontWeight="bold"
          fill={colors.text.primary}
          textAnchor="middle"
        >
          {centerNode.label}
        </SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
