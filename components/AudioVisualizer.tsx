import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  mode?: 'bar' | 'orb'; // Added mode for different visual styles
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  analyser, 
  isActive, 
  mode = 'bar',
  color = '#06b6d4' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let animationId: number;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!isActive) {
        // Draw idle state
        ctx.beginPath();
        ctx.strokeStyle = `${color}33`; // Low opacity
        ctx.lineWidth = 2;
        ctx.arc(rect.width / 2, rect.height / 2, 30, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      if (mode === 'orb') {
        // Organic Orb Visualization
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(rect.width, rect.height) / 3.5;
        
        ctx.beginPath();
        ctx.moveTo(centerX + radius, centerY);

        // Calculate average frequency for core pulse
        let avgFreq = 0;
        for(let i = 0; i < bufferLength; i++) avgFreq += dataArray[i];
        avgFreq = avgFreq / bufferLength;

        // Draw distorted circle based on frequency data
        for (let i = 0; i <= bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const val = dataArray[i % bufferLength] / 255.0;
          const offset = val * 40; // Amplitude
          
          const r = radius + offset + (avgFreq * 0.1);
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        
        // Glow effect
        const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5);
        gradient.addColorStop(0, `${color}`);
        gradient.addColorStop(1, `${color}00`);
        
        ctx.fillStyle = `${color}22`; // Inner fill
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

      } else {
        // Traditional Bar Graph
        const barWidth = (rect.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * rect.height * 0.8;

          ctx.fillStyle = color;
          
          // Draw rounded bars
          const y = rect.height - barHeight;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          x += barWidth + 1;
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive, mode, color]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default AudioVisualizer;