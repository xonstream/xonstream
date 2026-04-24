import React from 'react';

interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
}

const Loader: React.FC<LoaderProps> = ({ size = 'medium' }) => {
  // Bigger scaling for visibility - small is now 0.8 instead of 0.5
  const scale = size === 'small' ? 0.8 : size === 'large' ? 1.5 : 1;
  const square = 20 * scale;  // Base size slightly smaller for better proportions
  const offset = 22 * scale;  // Tighter spacing
  const duration = '2.4s';
  const delay = '0.2s';
  
  const containerStyle: React.CSSProperties = {
    width: 3 * offset + square,
    height: 2 * offset + square,
    position: 'relative',
    margin: '0 auto',
  };

  const squareStyle = (id: number): React.CSSProperties => ({
    position: 'absolute',
    width: square,
    height: square,
    backgroundColor: 'darkorange',
    borderRadius: 2,
    animation: `square${id} ${duration} ${delay} ease-in-out infinite, squarefadein 0.4s ${id * 0.1}s ease-out both`,
  });

  const positions: Record<number, React.CSSProperties> = {
    1: { left: 0, top: 0 },
    2: { left: 0, top: offset },
    3: { left: offset, top: offset },
    4: { left: 2 * offset, top: offset },
    5: { left: 3 * offset, top: offset },
  };

  return (
    <div style={containerStyle}>
      {[1, 2, 3, 4, 5].map((id) => (
        <div
          key={id}
          style={{
            ...squareStyle(id),
            ...positions[id],
          }}
        />
      ))}
      <style>{`
        @keyframes square1 {
          0% { left: 0; top: 0; }
          8.333% { left: 0; top: ${offset}px; }
          100% { left: 0; top: ${offset}px; }
        }
        @keyframes square2 {
          0% { left: 0; top: ${offset}px; }
          8.333% { left: 0; top: ${2 * offset}px; }
          16.67% { left: ${offset}px; top: ${2 * offset}px; }
          25% { left: ${offset}px; top: ${offset}px; }
          83.33% { left: ${offset}px; top: ${offset}px; }
          91.67% { left: ${offset}px; top: 0; }
          100% { left: 0; top: 0; }
        }
        @keyframes square3 {
          0%, 100% { left: ${offset}px; top: ${offset}px; }
          16.67% { left: ${offset}px; top: ${offset}px; }
          25% { left: ${offset}px; top: 0; }
          33.33% { left: ${2 * offset}px; top: 0; }
          41.67% { left: ${2 * offset}px; top: ${offset}px; }
          66.67% { left: ${2 * offset}px; top: ${offset}px; }
          75% { left: ${2 * offset}px; top: ${2 * offset}px; }
          83.33% { left: ${offset}px; top: ${2 * offset}px; }
          91.67% { left: ${offset}px; top: ${offset}px; }
        }
        @keyframes square4 {
          0% { left: ${2 * offset}px; top: ${offset}px; }
          33.33% { left: ${2 * offset}px; top: ${offset}px; }
          41.67% { left: ${2 * offset}px; top: ${2 * offset}px; }
          50% { left: ${3 * offset}px; top: ${2 * offset}px; }
          58.33% { left: ${3 * offset}px; top: ${offset}px; }
          100% { left: ${3 * offset}px; top: ${offset}px; }
        }
        @keyframes square5 {
          0% { left: ${3 * offset}px; top: ${offset}px; }
          50% { left: ${3 * offset}px; top: ${offset}px; }
          58.33% { left: ${3 * offset}px; top: 0; }
          66.67% { left: ${2 * offset}px; top: 0; }
          75% { left: ${2 * offset}px; top: ${offset}px; }
          100% { left: ${2 * offset}px; top: ${offset}px; }
        }
        @keyframes squarefadein {
          0% { transform: scale(0.75); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Loader;
