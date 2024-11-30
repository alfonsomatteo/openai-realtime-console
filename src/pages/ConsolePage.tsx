import { useEffect, useRef } from 'react';
import { WavRecorder } from '../lib/wavtools/index.js';
import { WavRenderer } from '../utils/wav_renderer';

import './ConsolePage.scss';

export function ConsolePage() {
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );

  /**
   * Connessione automatica all'API
   */
  useEffect(() => {
    const connectToAPI = async () => {
      try {
        await wavRecorderRef.current.begin();
        console.log('Connected to API successfully.');
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    };

    connectToAPI();
  }, []);

  /**
   * Render loop per la forma d'onda
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const renderWave = () => {
      if (isLoaded && clientCanvas) {
        if (!clientCanvas.width || !clientCanvas.height) {
          clientCanvas.width = clientCanvas.offsetWidth;
          clientCanvas.height = clientCanvas.offsetHeight;
        }
        clientCtx = clientCtx || clientCanvas.getContext('2d');
        if (clientCtx) {
          clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);

          const frequencies = wavRecorder.recording
            ? wavRecorder.getFrequencies('voice')
            : { values: new Float32Array([Math.random() * 0.5]) };

          WavRenderer.drawBars(
            clientCanvas,
            clientCtx,
            frequencies.values,
            '#00ff00', // Colore dell'onda
            10, // Spessore delle barre
            0,
            8
          );
        }
      }
      window.requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      isLoaded = false;
    };
  }, []);

  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/logo_cartesian_web.svg" alt="Logo" />
          <span>Realtime Console</span>
        </div>
      </div>
      <div className="content-main">
        <div className="content-wave">
          <canvas ref={clientCanvasRef} className="waveform-canvas" />
        </div>
      </div>
    </div>
  );
}
