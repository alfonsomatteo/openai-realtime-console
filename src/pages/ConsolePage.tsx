/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';

import './ConsolePage.scss';

/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

export function ConsolePage() {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Missing OpenAI API Key. Please set REACT_APP_OPENAI_API_KEY.');
  }

  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    const wavRecorder = wavRecorderRef.current;

    // Check if recording is already active
    if (wavRecorder.isRecording()) {
      await wavRecorder.pause(); // Pause the recording first
    }

    setIsRecording(true);
    const client = clientRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  const stopRecording = async () => {
    const wavRecorder = wavRecorderRef.current;
    setIsRecording(false);
    await wavRecorder.pause();
    clientRef.current.createResponse();
  };

  useEffect(() => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;

    client.updateSession({
      turn_detection: { type: 'server_vad' },
    });

    if (client.isConnected()) {
      wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }

    setIsRecording(false);
  }, []);

  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/logo_cartesian_web.svg" />
          <span>realtime console</span>
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {/* Here will be the conversation items */}
            </div>
          </div>
        </div>
        <div className="content-actions">
          <Button onClick={startRecording}>Start Recording</Button>
          <Button onClick={stopRecording}>Stop Recording</Button>
        </div>
      </div>
    </div>
  );
}


